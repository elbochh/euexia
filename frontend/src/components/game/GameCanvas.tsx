'use client';
import { useEffect, useRef, useCallback } from 'react';
import {
  Application,
  Graphics,
  Container,
  Text,
  TextStyle,
  Sprite,
  Assets,
  AnimatedSprite,
  Texture,
  Rectangle,
} from 'pixi.js';
import { getTheme, GameTheme } from './themes';
import type { PersonalizedMapSpec } from '@/stores/gameStore';
import { getOrRenderKenneySpriteSheet } from '@/lib/kenneyModelSpriteRenderer';

interface ChecklistItem {
  _id: string;
  title: string;
  description: string;
  frequency: string;
  isCompleted: boolean;
  isLocked?: boolean;
  isAvailable?: boolean;
  xpReward: number;
  coinReward: number;
  category: string;
  order: number;
}

interface GameCanvasProps {
  theme: string;
  completedCount: number;
  totalCount: number;
  mapSpec?: PersonalizedMapSpec | null;
  checklistItems?: ChecklistItem[];
  eventsPerStar?: ChecklistItem[][];
  onCheckpointClick?: (index: number) => void;
  userName?: string;
  playerCharacterId?: string;
  introMessage?: string;
}

export default function GameCanvas({
  theme,
  completedCount,
  totalCount,
  mapSpec,
  checklistItems = [],
  eventsPerStar,
  onCheckpointClick,
  userName,
  playerCharacterId,
  introMessage,
}: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const renderSeqRef = useRef(0);
  const lastCompletedRef = useRef(0);
  const lastMapKeyRef = useRef('');
  const scrollContainerRef = useRef<Container | null>(null);
  const scrollYRef = useRef(0);
  const maxScrollYRef = useRef(0);

  const loadAnimationFrames = useCallback(
    async (characterId: 'player' | 'doctor', animation: 'walk' | 'idle'): Promise<Texture[] | null> => {
      try {
        const spriteUrl = await getOrRenderKenneySpriteSheet(characterId, animation);
        if (!spriteUrl) return null;
        const spriteTexture = (await Assets.load(spriteUrl)) as Texture;
        const frameCount = 12;
        const frameWidth = spriteTexture.width / frameCount;
        const frameHeight = spriteTexture.height;
        const frames: Texture[] = [];
        for (let i = 0; i < frameCount; i += 1) {
          frames.push(
            new Texture({
              source: spriteTexture.source,
              frame: new Rectangle(i * frameWidth, 0, frameWidth, frameHeight),
            })
          );
        }
        return frames.length > 0 ? frames : null;
      } catch (error) {
        console.warn(`Failed to load Kenney model animation for ${characterId}/${animation}:`, error);
        return null;
      }
    },
    []
  );

  const loadKenneyCharacterFrames = useCallback(
    async (characterId: 'player' | 'doctor', skinId?: string): Promise<Texture[] | null> => {
      const assetPath =
        characterId === 'doctor'
          ? '/kenney_blocky-characters_20/Previews/character-i.png'
          : skinId
          ? `/kenney_blocky-characters_20/Previews/${skinId}.png`
          : '/kenney_blocky-characters_20/Previews/character-a.png';
      try {
        const texture = (await Assets.load(assetPath)) as Texture;
        if (!texture?.source) return null;
        return [texture];
      } catch (error) {
        console.warn(`Failed to load Kenney ${characterId} sprite (${assetPath}):`, error);
        return null;
      }
    },
    []
  );

  const drawMap = useCallback(
    async (
      app: Application,
      _themeData: GameTheme,
      completed: number,
      total: number,
      _dynamicSpec?: PersonalizedMapSpec | null,
      displayName?: string
    ) => {
      const renderSeq = ++renderSeqRef.current;
      const isRenderActive = () => appRef.current === app && renderSeqRef.current === renderSeq && !!app.stage;
      if (!isRenderActive()) return;

      const { width, height } = app.screen;

      while (app.stage.children.length > 0) app.stage.removeChildAt(0);
      scrollContainerRef.current = null;
      scrollYRef.current = 0;
      maxScrollYRef.current = 0;

      // ═══════════════════════════════════════════════════════════════════════
      // PROCEDURAL ISLAND — 48-row tall map with meandering river, 3 biomes
      //   Bottom (rows 32-47): Autumn / dirt
      //   Middle (rows 16-31): Green / grass
      //   Top    (rows 0-15):  Snow / ice
      // ═══════════════════════════════════════════════════════════════════════

      const _W = 1, _D = 2, _G = 3, _S = 4, _T = 5, _N = 6, _A = 7;
      type Cell = [number, number] | null;

      const hash = (a: number, b: number) => {
        const h = ((a * 1664525 + b * 1013904223) ^ (a << 16)) & 0xffffffff;
        return (h >>> 0) / 0xffffffff;
      };
      const clamp = (v: number, mn: number, mx: number) => {
        if (mn > mx) return (mn + mx) / 2;
        return Math.max(mn, Math.min(mx, v));
      };

      const TOTAL_ROWS = 48;
      const GRID_COLS = 12;

      // River center column per row (meanders via sine wave)
      const riverCol: number[] = [];
      for (let r = 0; r < TOTAL_ROWS; r++) {
        riverCol.push(Math.round(5.5 + 2.8 * Math.sin(r * 0.22 + 0.8)));
      }

      // Island left/right boundaries per row (organic shape)
      const bounds: [number, number][] = [];
      for (let r = 0; r < TOTAL_ROWS; r++) {
        let left = 0, right = GRID_COLS - 1;
        if (r === 0) left = 5;
        else if (r === 1) left = 4;
        else if (r <= 3) left = 3;
        else if (r <= 6) left = 2;
        else if (r <= 12) left = 1;
        if (r >= 36) { left = Math.max(left, 2); right = Math.min(right, 9); }
        else if (r >= 35) { left = Math.max(left, 1); right = Math.min(right, 10); }
        bounds.push([left, right]);
      }

      // Build island grid procedurally
      const ISLAND: Cell[][] = [];
      for (let row = 0; row < TOTAL_ROWS; row++) {
        const cells: Cell[] = [];
        const rc = riverCol[row];
        const [bL, bR] = bounds[row];
        const biome = row < 16 ? 0 : row < 32 ? 1 : 2; // 0=snow, 1=green, 2=autumn

        for (let col = 0; col < GRID_COLS; col++) {
          if (col < bL || col > bR) { cells.push(null); continue; }

          const dist = Math.abs(col - rc);
          const h1 = hash(row * 13 + col * 7, row * 31 + col * 19);

          // River: always 2 tiles wide for continuous water look
          const isWater = col === rc || col === rc - 1;
          if (isWater) { cells.push([_W, 0]); continue; }

          // Smooth elevation: gradual curve from 1 (bottom) to 4 (top)
          const t = 1 - row / (TOTAL_ROWS - 1);
          const baseElev = 1 + t * t * 3;
          const noise = (h1 - 0.5) * 0.6;
          const elev = Math.max(1, Math.min(4, Math.round(baseElev + noise)));

          let type: number;
          const distFromWater = Math.min(Math.abs(col - rc), Math.abs(col - (rc - 1)));

          if (biome === 0) {
            if (distFromWater === 1) type = _T;
            else type = (col > rc && row < 6) || h1 > 0.45 ? _N : _T;
          } else if (biome === 1) {
            if (distFromWater === 1) type = _S;
            else type = _G;
          } else {
            if (distFromWater === 1) type = _D;
            else type = h1 > 0.45 ? _A : _D;
          }

          cells.push([type, elev]);
        }
        ISLAND.push(cells);
      }

      const GRID_ROWS = TOTAL_ROWS;

      // ── Grid geometry ──────────────────────────────────────────────────────
      const hexColStep = Math.ceil(width / (GRID_COLS + 1));
      const tileW = Math.ceil(hexColStep / 0.75);
      const tileH = Math.floor(tileW * 1.15);
      const STACK_H = Math.floor(tileH * 0.5);
      const rowStep = Math.floor(tileH * 0.55);

      const PADDING_TOP = 150;
      const PADDING_BOT = 180;
      const gridContentH = GRID_ROWS * rowStep + 4 * STACK_H + tileH;
      const mapHeight = gridContentH + PADDING_TOP + PADDING_BOT;

      // ── Scroll container ───────────────────────────────────────────────────
      const scrollContainer = new Container();
      scrollContainerRef.current = scrollContainer;
      maxScrollYRef.current = Math.max(0, mapHeight - height);
      scrollYRef.current = maxScrollYRef.current;
      scrollContainer.y = -scrollYRef.current;

      const viewMask = new Graphics();
      viewMask.rect(0, 0, width, height);
      viewMask.fill(0xffffff);
      app.stage.addChild(viewMask);
      scrollContainer.mask = viewMask;
      app.stage.addChild(scrollContainer);

      // ── Load textures ──────────────────────────────────────────────────────
      const P = '/kenney_hexagon-tiles/Tiles/';
      const loadTex = (p: string) => Assets.load(p).catch(() => null) as Promise<Texture | null>;

      const [
        texGrassFull, texDirtFull, texSandFull, texSnowFull,
        texStoneFull, texWaterFull, texAutumnFull,
        texWaterFlat,
        texTreeGreenLow, texTreeGreenMid, texTreeGreenHigh,
        texPineGreenLow, texPineGreenMid, texPineGreenHigh,
        texPineBlueLow, texPineBlueMid, texPineBlueHigh,
        texTreeAutumnLow, texTreeAutumnMid, texTreeAutumnHigh,
        texPineAutumnMid, texPineAutumnHigh,
        texCactus1, texCactus2, texCactus3,
        texRockSnow1, texRockSnow3, texSmallRockSnow,
        texRockStone, texSmallRockStone, texRockStoneMoss1,
        texRockDirt, texRockDirtMoss1, texSmallRockDirt, texSmallRockGrass,
        texBushGrass, texBushSand, texBushSnow, texBushAutumn,
        texFlowerRed, texFlowerYellow, texFlowerWhite,
        texFlowerBlue, texFlowerGreen,
        texHillGrass, texHillSand, texHillSnow, texHillAutumn,
        chainTexture,
        texCoin,
      ] = await Promise.all([
        loadTex(`${P}tileGrass_full.png`), loadTex(`${P}tileDirt_full.png`),
        loadTex(`${P}tileSand_full.png`),  loadTex(`${P}tileSnow_full.png`),
        loadTex(`${P}tileStone_full.png`), loadTex(`${P}tileWater_full.png`),
        loadTex(`${P}tileAutumn_full.png`),
        loadTex(`${P}tileWater.png`),
        loadTex(`${P}treeGreen_low.png`),  loadTex(`${P}treeGreen_mid.png`),
        loadTex(`${P}treeGreen_high.png`),
        loadTex(`${P}pineGreen_low.png`),  loadTex(`${P}pineGreen_mid.png`),
        loadTex(`${P}pineGreen_high.png`),
        loadTex(`${P}pineBlue_low.png`),   loadTex(`${P}pineBlue_mid.png`),
        loadTex(`${P}pineBlue_high.png`),
        loadTex(`${P}treeAutumn_low.png`), loadTex(`${P}treeAutumn_mid.png`),
        loadTex(`${P}treeAutumn_high.png`),
        loadTex(`${P}pineAutumn_mid.png`), loadTex(`${P}pineAutumn_high.png`),
        loadTex(`${P}treeCactus_1.png`),   loadTex(`${P}treeCactus_2.png`),
        loadTex(`${P}treeCactus_3.png`),
        loadTex(`${P}rockSnow_1.png`),     loadTex(`${P}rockSnow_3.png`),
        loadTex(`${P}smallRockSnow.png`),
        loadTex(`${P}rockStone.png`),      loadTex(`${P}smallRockStone.png`),
        loadTex(`${P}rockStone_moss1.png`),
        loadTex(`${P}rockDirt.png`),       loadTex(`${P}rockDirt_moss1.png`),
        loadTex(`${P}smallRockDirt.png`),  loadTex(`${P}smallRockGrass.png`),
        loadTex(`${P}bushGrass.png`),      loadTex(`${P}bushSand.png`),
        loadTex(`${P}bushSnow.png`),       loadTex(`${P}bushAutumn.png`),
        loadTex(`${P}flowerRed.png`),      loadTex(`${P}flowerYellow.png`),
        loadTex(`${P}flowerWhite.png`),
        loadTex(`${P}flowerBlue.png`),     loadTex(`${P}flowerGreen.png`),
        loadTex(`${P}hillGrass.png`),      loadTex(`${P}hillSand.png`),
        loadTex(`${P}hillSnow.png`),       loadTex(`${P}hillAutumn.png`),
        Assets.load('/chains.png').catch(() => null) as Promise<Texture | null>,
        Assets.load('/isomteric-game-coin.png').catch(() => null) as Promise<Texture | null>,
      ]);

      if (!isRenderActive()) return;

      // ── Helpers ────────────────────────────────────────────────────────────
      const xOrigin = hexColStep;
      const hexPos = (row: number, col: number) => ({
        x: xOrigin + col * hexColStep + (row % 2 === 1 ? hexColStep * 0.5 : 0),
        y: PADDING_TOP + row * rowStep + tileH / 2,
      });

      const topSurfaceY = (row: number, col: number) => {
        const cell = ISLAND[row]?.[col];
        const elev = cell && cell[0] !== _W ? Math.max(cell[1], 1) : 1;
        const { y } = hexPos(row, col);
        return y - Math.max(0, elev - 1) * STACK_H - tileH * 0.22;
      };

      const getSurfaceTex = (type: number): Texture | null => {
        if (type === _G) return texGrassFull;
        if (type === _D) return texDirtFull;
        if (type === _S) return texSandFull;
        if (type === _N) return texSnowFull;
        if (type === _T) return texStoneFull;
        if (type === _A) return texAutumnFull;
        return null;
      };

      const getSideTex = (type: number): Texture | null => {
        if (type === _G) return texDirtFull;
        if (type === _S) return texSandFull;
        if (type === _N) return texStoneFull;
        if (type === _T) return texStoneFull;
        if (type === _A) return texAutumnFull;
        return texDirtFull;
      };

      // ── Background ─────────────────────────────────────────────────────────
      const skyBg = new Graphics();
      const bands = 9;
      for (let i = 0; i < bands; i += 1) {
        const t = i / Math.max(1, bands - 1);
        const r = Math.round(42 + t * 35);
        const g = Math.round(87 + t * 44);
        const b = Math.round(126 + t * 54);
        skyBg.rect(0, (height / bands) * i, width, height / bands + 1);
        skyBg.fill((r << 16) + (g << 8) + b);
      }
      skyBg.rect(0, height * 0.68, width, height * 0.32);
      skyBg.fill({ color: 0x3f6f9e, alpha: 0.42 });
      app.stage.addChildAt(skyBg, 0);

      const atmosphere = new Graphics();
      atmosphere.circle(width * 0.16, height * 0.12, Math.max(70, width * 0.24));
      atmosphere.fill({ color: 0xfef3c7, alpha: 0.16 });
      atmosphere.circle(width * 0.86, height * 0.24, Math.max(110, width * 0.34));
      atmosphere.fill({ color: 0x7dd3fc, alpha: 0.11 });
      atmosphere.circle(width * 0.52, height * 0.88, Math.max(130, width * 0.42));
      atmosphere.fill({ color: 0x22c55e, alpha: 0.08 });
      app.stage.addChildAt(atmosphere, 1);

      const cloudLayer = new Graphics();
      for (let i = 0; i < 7; i += 1) {
        const cx = (width * (0.1 + i * 0.16)) % (width + 80) - 40;
        const cy = height * (0.12 + (i % 3) * 0.14);
        cloudLayer.ellipse(cx, cy, 44 + (i % 2) * 18, 13 + (i % 3) * 3);
        cloudLayer.fill({ color: 0xffffff, alpha: 0.08 });
      }
      app.stage.addChildAt(cloudLayer, 2);

      // ── Tile rendering ─────────────────────────────────────────────────────
      const tileLayer = new Container();
      const islandShadow = new Graphics();
      for (let row = 0; row < GRID_ROWS; row += 2) {
        const [left, right] = bounds[row];
        const leftPos = hexPos(row, left);
        const rightPos = hexPos(row, right);
        islandShadow.roundRect(
          leftPos.x - tileW * 0.7,
          leftPos.y + tileH * 0.18,
          rightPos.x - leftPos.x + tileW * 1.35,
          rowStep * 2.3,
          tileH * 0.2
        );
        islandShadow.fill({ color: 0x082f49, alpha: 0.08 });
      }
      tileLayer.addChild(islandShadow);

      for (let row = 0; row < GRID_ROWS; row++) {
        for (let col = 0; col < GRID_COLS; col++) {
          const cell = ISLAND[row]?.[col];
          if (!cell) continue;
          const [type, elev] = cell;
          const { x, y } = hexPos(row, col);

          if (type === _W) {
            const tex = texWaterFlat || texWaterFull;
            if (tex) {
              const spr = new Sprite(tex);
              spr.anchor.set(0.5, 0.5);
              spr.scale.set((tileW / tex.width) * 1.14);
              spr.position.set(x, y);
              tileLayer.addChild(spr);
            }
          } else if (elev > 0) {
            const surf = getSurfaceTex(type);
            const side = getSideTex(type);
            for (let s = 0; s < elev; s++) {
              const tex = s === elev - 1 ? surf : side;
              if (tex) {
                const spr = new Sprite(tex);
                spr.anchor.set(0.5, 0.5);
                spr.scale.set((tileW / tex.width) * 1.06);
                spr.position.set(x, y - s * STACK_H);
                tileLayer.addChild(spr);
              }
            }
          }
        }
      }
      scrollContainer.addChild(tileLayer);

      const riverSparkleLayer = new Graphics();
      for (let row = 1; row < GRID_ROWS - 1; row += 3) {
        const rc = riverCol[row];
        const { x, y } = hexPos(row, rc);
        const drift = (hash(row * 91, rc * 37) - 0.5) * tileW * 0.45;
        riverSparkleLayer.ellipse(x + drift, y - tileH * 0.08, tileW * 0.18, tileH * 0.035);
        riverSparkleLayer.fill({ color: 0xe0f2fe, alpha: 0.28 });
        if (row % 6 === 1) {
          riverSparkleLayer.ellipse(x + tileW * 0.34, y + tileH * 0.06, tileW * 0.12, tileH * 0.025);
          riverSparkleLayer.fill({ color: 0xbae6fd, alpha: 0.20 });
        }
      }
      scrollContainer.addChild(riverSparkleLayer);

      // ── Decorations ────────────────────────────────────────────────────────
      const decorLayer = new Container();
      for (let row = 0; row < GRID_ROWS; row++) {
        for (let col = 0; col < GRID_COLS; col++) {
          const cell = ISLAND[row]?.[col];
          if (!cell || cell[0] === _W) continue;
          const [type, elev] = cell;
          const { x } = hexPos(row, col);
          const topY = topSurfaceY(row, col);

          const h1 = hash(row * 41 + col * 13, row * 7 + col * 29);
          const h2 = hash(row * 19 + col * 37, row * 23 + col * 11);

          let propTex: Texture | null = null;
          let sc = 1.0;
          let cap = 0;

          if (type === _G) {
            cap = elev >= 2 ? 0.38 : 0.28;
            if (h2 < 0.08) { propTex = texTreeGreenHigh; sc = 1.2; }
            else if (h2 < 0.15) { propTex = texPineGreenMid; sc = 1.05; }
            else if (h2 < 0.22) { propTex = texTreeGreenLow; sc = 0.9; }
            else if (h2 < 0.35) { propTex = texBushGrass; sc = 0.55; }
            else if (h2 < 0.48) { propTex = texFlowerYellow; sc = 0.38; }
            else if (h2 < 0.60) { propTex = texFlowerWhite; sc = 0.36; }
            else if (h2 < 0.72) { propTex = texFlowerBlue; sc = 0.36; }
            else if (h2 < 0.84) { propTex = texSmallRockGrass; sc = 0.45; }
            else { propTex = texHillGrass; sc = 0.50; }
          } else if (type === _S) {
            cap = 0.28;
            if (h2 < 0.2) { propTex = texCactus1; sc = 0.8; }
            else if (h2 < 0.4) { propTex = texBushSand; sc = 0.50; }
            else if (h2 < 0.65) { propTex = texSmallRockDirt; sc = 0.40; }
            else { propTex = texHillSand; sc = 0.50; }
          } else if (type === _N) {
            cap = 0.32;
            if (h2 < 0.12) { propTex = texPineBlueHigh; sc = 1.15; }
            else if (h2 < 0.22) { propTex = texPineBlueMid; sc = 1.0; }
            else if (h2 < 0.38) { propTex = texRockSnow1; sc = 0.70; }
            else if (h2 < 0.52) { propTex = texRockSnow3; sc = 0.60; }
            else if (h2 < 0.68) { propTex = texSmallRockSnow; sc = 0.50; }
            else if (h2 < 0.84) { propTex = texBushSnow; sc = 0.50; }
            else { propTex = texHillSnow; sc = 0.50; }
          } else if (type === _T) {
            cap = 0.25;
            if (h2 < 0.30) { propTex = texRockStone; sc = 0.60; }
            else if (h2 < 0.55) { propTex = texRockStoneMoss1; sc = 0.55; }
            else if (h2 < 0.80) { propTex = texSmallRockStone; sc = 0.45; }
            else { propTex = texPineBlueLow; sc = 0.75; }
          } else if (type === _D) {
            cap = 0.24;
            if (h2 < 0.30) { propTex = texRockDirtMoss1; sc = 0.50; }
            else if (h2 < 0.55) { propTex = texSmallRockDirt; sc = 0.42; }
            else if (h2 < 0.80) { propTex = texBushAutumn; sc = 0.48; }
            else { propTex = texRockDirt; sc = 0.50; }
          } else if (type === _A) {
            cap = 0.32;
            if (h2 < 0.10) { propTex = texTreeAutumnMid; sc = 1.0; }
            else if (h2 < 0.18) { propTex = texPineAutumnMid; sc = 0.95; }
            else if (h2 < 0.25) { propTex = texTreeAutumnLow; sc = 0.80; }
            else if (h2 < 0.40) { propTex = texBushAutumn; sc = 0.50; }
            else if (h2 < 0.55) { propTex = texHillAutumn; sc = 0.50; }
            else if (h2 < 0.72) { propTex = texSmallRockDirt; sc = 0.42; }
            else { propTex = texRockDirt; sc = 0.48; }
          }

          if (!propTex || h1 >= cap) continue;

          const spr = new Sprite(propTex);
          spr.anchor.set(0.5, 1);
          spr.scale.set((tileW * sc) / propTex.width);
          spr.position.set(x + (h2 - 0.5) * tileW * 0.25, topY);
          decorLayer.addChild(spr);
        }
      }
      scrollContainer.addChild(decorLayer);

      // ═══════════════════════════════════════════════════════════════════════
      // GAME OVERLAY: Path, Stars, Flags, Characters
      // ═══════════════════════════════════════════════════════════════════════

      const starCount = Math.max(total, 2);
      const COIN_R = Math.min(28, Math.max(18, Math.floor(width * 0.068)));
      const COIN_FLOAT = 25;

      const routeRows = [47, 44, 41, 38, 35, 32, 29, 26, 23, 20, 17, 14, 11, 8, 5, 2];
      const findRouteCell = (row: number, index: number) => {
        const safeRow = clamp(row, 0, GRID_ROWS - 1);
        const [left, right] = bounds[safeRow];
        const rc = riverCol[safeRow];
        const side = index % 2 === 0 ? -1 : 1;
        const preferred = clamp(rc + side * (3 + (index % 3 === 0 ? 1 : 0)), left, right);

        for (let radius = 0; radius < GRID_COLS; radius += 1) {
          const candidates = radius === 0 ? [preferred] : [preferred - radius, preferred + radius];
          for (const c of candidates) {
            const col = clamp(c, left, right);
            const cell = ISLAND[safeRow]?.[col];
            if (cell && cell[0] !== _W) return { row: safeRow, col };
          }
        }

        for (let col = left; col <= right; col += 1) {
          const cell = ISLAND[safeRow]?.[col];
          if (cell && cell[0] !== _W) return { row: safeRow, col };
        }
        return { row: safeRow, col: left };
      };

      const FULL_PATH = routeRows.map((row, index) => findRouteCell(row, index));

      const pickPositions = (count: number) => {
        if (count <= 1) return [FULL_PATH[0]];
        const result: { row: number; col: number }[] = [];
        for (let i = 0; i < count; i++) {
          const t = i / (count - 1);
          if (count <= FULL_PATH.length) {
            const idx = Math.min(Math.round(t * (FULL_PATH.length - 1)), FULL_PATH.length - 1);
            result.push(FULL_PATH[idx]);
          } else {
            const row = Math.round((TOTAL_ROWS - 1) - t * (TOTAL_ROWS - 3));
            result.push(findRouteCell(row, i));
          }
        }
        return result;
      };

      const starGridPos = pickPositions(starCount);

      const starPixels = starGridPos.map(({ row, col }) => {
        const { x } = hexPos(row, col);
        const sy = topSurfaceY(row, col);
        return { x, y: sy - COIN_FLOAT };
      });

      const startFlagPixel = {
        x: starPixels[0].x,
        y: starPixels[0].y + COIN_FLOAT + 40,
      };
      const endFlagPixel = {
        x: starPixels[starPixels.length - 1].x,
        y: starPixels[starPixels.length - 1].y - 40,
      };

      const initialFocusIdx = Math.max(-1, Math.min(completed - 1, starCount - 1));
      const initialFocus = initialFocusIdx < 0 ? startFlagPixel : starPixels[initialFocusIdx];
      scrollYRef.current = clamp(initialFocus.y - height * 0.62, 0, maxScrollYRef.current);
      scrollContainer.y = -scrollYRef.current;

      // ── Dotted path (quadratic Bézier arcs between nodes) ─────────────────
      const allPathPts = [startFlagPixel, ...starPixels, endFlagPixel];
      const pathGfx = new Graphics();
      const progressGfx = new Graphics();

      // Evaluate a quadratic Bézier at t: P0, control, P2
      const bezier = (p0: number, cp: number, p2: number, t: number) =>
        (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * cp + t * t * p2;

      for (let i = 0; i < allPathPts.length - 1; i++) {
        const p1 = allPathPts[i], p2 = allPathPts[i + 1];
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Perpendicular offset for the arc — alternates left/right per segment
        const perpLen = Math.min(dist * 0.28, 40);
        const nx = -dy / dist, ny = dx / dist; // unit perpendicular
        const side = (i % 2 === 0) ? 1 : -1;
        const cpx = (p1.x + p2.x) / 2 + nx * perpLen * side;
        const cpy = (p1.y + p2.y) / 2 + ny * perpLen * side;

        const numDots = Math.max(3, Math.floor(dist / 14));
        for (let j = 0; j <= numDots; j++) {
          const t = j / numDots;
          const bx = bezier(p1.x, cpx, p2.x, t);
          const by = bezier(p1.y, cpy, p2.y, t);
          pathGfx.circle(bx, by + 2.2, 7);    pathGfx.fill({ color: 0x020617, alpha: 0.28 });
          pathGfx.circle(bx, by + 0.5, 5.4);  pathGfx.fill({ color: 0xffffff, alpha: 0.96 });
          pathGfx.circle(bx, by - 1.6, 3.1);  pathGfx.fill({ color: 0xdff7ff, alpha: 0.7 });
        }

        const segIdx = i - 1;
        if (segIdx < completed) {
          for (let j = 0; j <= numDots; j++) {
            const t = j / numDots;
            const bx = bezier(p1.x, cpx, p2.x, t);
            const by = bezier(p1.y, cpy, p2.y, t);
            progressGfx.circle(bx, by + 0.5, 6.0); progressGfx.fill({ color: 0x064e3b, alpha: 0.42 });
            progressGfx.circle(bx, by, 5.1);       progressGfx.fill({ color: 0x34d399, alpha: 1 });
            progressGfx.circle(bx, by - 1.7, 3.0); progressGfx.fill({ color: 0xbbf7d0, alpha: 0.85 });
          }
        }
      }
      const pathCont = new Container();
      pathCont.addChild(pathGfx, progressGfx);
      scrollContainer.addChild(pathCont);

      // ── Checkpoint tokens (alien sprites from Kenney pack) ─────────────────
      const checkpointContainer = new Container();
      const floatingCoins: Array<{ container: Container; baseY: number; phaseOffset: number }> = [];

      // Coin token size — square since the coin image is ~1:1
      const TOKEN_H = Math.max(44, Math.min(62, tileH * 1.15));

      for (let index = 0; index < starCount; index++) {
        const { x: cx, y: cy } = starPixels[index];

        const eventsAtStar = eventsPerStar?.[index] ?? (checklistItems[index] ? [checklistItems[index]] : []);
        const totalStarCoins = eventsAtStar.reduce((sum, e: ChecklistItem) => sum + (e.coinReward || 0), 0);
        const earnedStarCoins = eventsAtStar.reduce(
          (sum, e: ChecklistItem) => sum + (e.isCompleted ? e.coinReward || 0 : 0),
          0
        );
        const isStarCompleted = eventsAtStar.some((e: ChecklistItem) => e.isCompleted);
        const hasAvailable = eventsAtStar.some((e: ChecklistItem) => !e.isCompleted && !e.isLocked);
        const isStarLocked = eventsAtStar.length > 0 && !isStarCompleted && !hasAvailable;
        const isCurrent = index === completed;
        const isLocked = isStarLocked || (eventsAtStar.length === 0 && index > completed);

        const checkpoint = new Container();
        checkpoint.position.set(cx, cy);
        checkpoint.eventMode = 'static';
        checkpoint.cursor = 'pointer';
        checkpoint.on('pointertap', () => onCheckpointClick?.(index));

        // Ground shadow ellipse (below coin)
        const shadow = new Graphics();
        shadow.ellipse(0, TOKEN_H * 0.1, TOKEN_H * 0.42, TOKEN_H * 0.11);
        shadow.fill({ color: 0x000000, alpha: 0.22 });
        checkpoint.addChild(shadow);
        (checkpoint as any)._shadow = shadow;

        const pedestal = new Graphics();
        pedestal.circle(0, -TOKEN_H * 0.25, TOKEN_H * 0.47);
        pedestal.fill({
          color: isStarCompleted ? 0x10b981 : isLocked ? 0x334155 : 0x0ea5e9,
          alpha: isLocked ? 0.14 : 0.18,
        });
        pedestal.circle(0, -TOKEN_H * 0.25, TOKEN_H * 0.36);
        pedestal.fill({ color: 0xffffff, alpha: isLocked ? 0.05 : 0.09 });
        checkpoint.addChild(pedestal);

        // Glow ring for current active coin
        if (isCurrent && !isLocked) {
          const glowG = new Graphics();
          glowG.circle(0, -TOKEN_H * 0.42, TOKEN_H * 0.66); glowG.fill({ color: 0xfbbf24, alpha: 0.14 });
          glowG.circle(0, -TOKEN_H * 0.42, TOKEN_H * 0.52); glowG.fill({ color: 0x38bdf8, alpha: 0.20 });
          glowG.circle(0, -TOKEN_H * 0.42, TOKEN_H * 0.42); glowG.fill({ color: 0xfef3c7, alpha: 0.18 });
          checkpoint.addChildAt(glowG, 0);
          (checkpoint as any)._isCurrentGlow = glowG;
          (checkpoint as any)._isCurrent = true;
        } else if (isStarCompleted) {
          const completeGlow = new Graphics();
          completeGlow.circle(0, -TOKEN_H * 0.42, TOKEN_H * 0.5);
          completeGlow.fill({ color: 0x34d399, alpha: 0.16 });
          checkpoint.addChildAt(completeGlow, 0);
        }

        // Coin sprite — tinted by state
        if (texCoin) {
          const spr = new Sprite(texCoin);
          spr.anchor.set(0.5, 0.8); // slightly below centre so shadow aligns
          const sc = TOKEN_H / Math.max(texCoin.width, texCoin.height);
          spr.scale.set(sc);
          spr.position.set(0, 0);
          // Tint: green = completed, grey = locked, gold = default (coin is already gold)
          if (isStarCompleted) spr.tint = 0x6ee7b7;       // mint green
          else if (isLocked)   { spr.tint = 0xaaaaaa; spr.alpha = 0.6; } // grey
          else if (isCurrent)  spr.tint = 0xffffff;        // pure/bright (no tint)
          else                 spr.tint = 0xfde68a;        // slightly dimmer gold
          checkpoint.addChild(spr);
        }

        // Lock icon over locked coins
        if (isLocked && !isStarCompleted) {
          const lockIcon = new Text({ text: '🔒', style: new TextStyle({ fontSize: TOKEN_H * 0.34, fontFamily: 'Arial' }) });
          lockIcon.anchor.set(0.5, 0.5);
          lockIcon.position.set(0, -TOKEN_H * 0.42);
          checkpoint.addChild(lockIcon);
        }

        // Label above the coin
        const completedEvent = eventsAtStar.find((e: ChecklistItem) => e.isCompleted);
        if (completedEvent?.title) {
          let titleTxt = completedEvent.title;
          if (titleTxt.length > 16) titleTxt = titleTxt.substring(0, 13) + '...';
          const lblStroke = new Text({ text: titleTxt, style: new TextStyle({
            fontSize: 13, fill: '#1a1a2e', fontFamily: 'Arial', fontWeight: 'bold',
            stroke: { color: 0x1a1a2e, width: 5, join: 'round' },
          }) });
          lblStroke.anchor.set(0.5, 1); lblStroke.position.set(0, -(TOKEN_H + 6));
          const lbl = new Text({ text: titleTxt, style: new TextStyle({
            fontSize: 13, fill: isStarCompleted ? '#d1fae5' : '#fef9c3',
            fontFamily: 'Arial', fontWeight: 'bold',
          }) });
          lbl.anchor.set(0.5, 1); lbl.position.set(0, -(TOKEN_H + 6));
          checkpoint.addChild(lblStroke, lbl);
        }

        checkpointContainer.addChild(checkpoint);

        // Day label + coin progress under each star
        const labelY = cy + COIN_R + 22;
        const labelBg = new Graphics();
        labelBg.roundRect(cx - 37, labelY - 10, 74, totalStarCoins > 0 ? 32 : 20, 10);
        labelBg.fill({ color: 0x020617, alpha: 0.56 });
        labelBg.stroke({ color: isStarCompleted ? 0x34d399 : isLocked ? 0x64748b : 0x38bdf8, width: 1, alpha: 0.36 });
        const dayLabelStroke = new Text({
          text: `Day ${index + 1}`,
          style: new TextStyle({
            fontSize: 11,
            fill: '#020617',
            fontFamily: 'Arial',
            fontWeight: 'bold',
            stroke: { color: 0x020617, width: 4, join: 'round' },
          }),
        });
        dayLabelStroke.anchor.set(0.5);
        dayLabelStroke.position.set(cx, labelY);
        const dayLabelFill = new Text({
          text: `Day ${index + 1}`,
          style: new TextStyle({
            fontSize: 11,
            fill: '#f9fafb',
            fontFamily: 'Arial',
            fontWeight: 'bold',
          }),
        });
        dayLabelFill.anchor.set(0.5);
        dayLabelFill.position.set(cx, labelY);

        const coinsLabel = new Text({
          text: totalStarCoins > 0 ? `${earnedStarCoins}/${totalStarCoins} coins` : '',
          style: new TextStyle({
            fontSize: 10,
            fill: '#e5e7eb',
            fontFamily: 'Arial',
          }),
        });
        coinsLabel.anchor.set(0.5);
        coinsLabel.position.set(cx, labelY + 14);

        scrollContainer.addChild(labelBg, dayLabelStroke, dayLabelFill, coinsLabel);
        floatingCoins.push({ container: checkpoint, baseY: cy, phaseOffset: index * 0.62 });
      }
      scrollContainer.addChild(checkpointContainer);

      // ── START and END flags ────────────────────────────────────────────────
      const drawFlag = (px: number, py: number, color: number, label: string, side: 'left' | 'right') => {
        const flag = new Container();
        flag.position.set(px, py);
        const base = new Graphics();
        base.ellipse(0, 6, 11, 5); base.fill({ color: 0x000000, alpha: 0.2 });
        const marker = new Graphics();
        marker.circle(0, 0, 9); marker.fill({ color: 0xffffff, alpha: 0.95 });
        marker.circle(0, 0, 7); marker.fill({ color, alpha: 1 });
        marker.stroke({ color: 0x111827, width: 1.2, alpha: 0.7 });
        const pX = side === 'left' ? -20 : 20;
        const pole = new Graphics();
        pole.roundRect(pX - 2, -34, 4, 38, 2); pole.fill(0x374151);
        const cloth = new Graphics();
        const cS = side === 'left' ? pX - 2 : pX + 2;
        const cE = side === 'left' ? pX - 24 : pX + 24;
        cloth.moveTo(cS, -32); cloth.lineTo(cE, -23); cloth.lineTo(cS, -14);
        cloth.closePath(); cloth.fill(color);
        cloth.stroke({ color: 0xffffff, width: 1, alpha: 0.85 });
        const txtStroke = new Text({ text: label, style: new TextStyle({
          fontSize: 12, fill: '#1a1a2e', fontFamily: 'Arial', fontWeight: 'bold',
          stroke: { color: 0x1a1a2e, width: 4, join: 'round' },
        }) });
        txtStroke.anchor.set(0.5); txtStroke.position.set(0, 20);
        const txt = new Text({ text: label, style: new TextStyle({ fontSize: 12, fill: '#fef9c3', fontFamily: 'Arial', fontWeight: 'bold' }) });
        txt.anchor.set(0.5); txt.position.set(0, 20);
        flag.addChild(base, marker, pole, cloth, txtStroke, txt);
        scrollContainer.addChild(flag);
      };

      drawFlag(startFlagPixel.x, startFlagPixel.y, 0x22c55e, 'START', 'right');
      drawFlag(endFlagPixel.x,   endFlagPixel.y,   0xef4444, 'END',   'left');

      // ═══════════════════════════════════════════════════════════════════════
      // CHARACTER SETUP
      // ═══════════════════════════════════════════════════════════════════════
      const characterTargetHeight = Math.max(58, Math.min(86, tileH * 1.45));
      const CHAR_SIDE_GAP = COIN_R + 44; // clearance from coin edge to character centre
      const CHAR_EDGE_PAD = characterTargetHeight * 0.42 + 8;

      const getStarPixel = (idx: number): { x: number; y: number } => {
        if (idx < 0) return startFlagPixel;
        if (idx >= starCount) return starPixels[starCount - 1];
        return starPixels[idx];
      };

      // Player: always to the LEFT of current star (clamped so never offscreen)
      const getPlayerPos = (starIdx: number) => {
        const { x: sx, y: sy } = getStarPixel(starIdx);
        const px = clamp(sx - CHAR_SIDE_GAP, CHAR_EDGE_PAD, width - CHAR_EDGE_PAD);
        return { x: px, y: sy + COIN_FLOAT + 8 };
      };

      // Doctor: always to the RIGHT of the star one step BEHIND the player
      // (trailing = same index as player but opposite side)
      const getDoctorPos = (starIdx: number) => {
        const { x: sx, y: sy } = getStarPixel(starIdx);
        const dx = clamp(sx + CHAR_SIDE_GAP, CHAR_EDGE_PAD, width - CHAR_EDGE_PAD);
        return { x: dx, y: sy + COIN_FLOAT + 8 };
      };

      // ── Draw player ────────────────────────────────────────────────────────
      const player = new Container();
      let playerSprite: AnimatedSprite | null = null;
      const sw = 2.5;
      const outline = { color: 0x000000, width: sw };
      player.scale.set(2);

      const playerShadow = new Graphics();
      playerShadow.ellipse(0, 0, 12, 6); playerShadow.fill({ color: 0x000000, alpha: 0.25 });
      player.addChild(playerShadow);
      const leftLeg = new Graphics();
      leftLeg.roundRect(-7, 10, 6, 11, 3); leftLeg.fill(0x2563eb); leftLeg.roundRect(-7, 10, 6, 11, 3); leftLeg.stroke(outline);
      player.addChild(leftLeg);
      const rightLeg = new Graphics();
      rightLeg.roundRect(1, 10, 6, 11, 3); rightLeg.fill(0x2563eb); rightLeg.roundRect(1, 10, 6, 11, 3); rightLeg.stroke(outline);
      player.addChild(rightLeg);
      const leftFoot = new Graphics();
      leftFoot.roundRect(-8, 20, 7, 3, 1); leftFoot.fill(0x1e293b); leftFoot.roundRect(-8, 20, 7, 3, 1); leftFoot.stroke(outline);
      player.addChild(leftFoot);
      const rightFoot = new Graphics();
      rightFoot.roundRect(1, 20, 7, 3, 1); rightFoot.fill(0x1e293b); rightFoot.roundRect(1, 20, 7, 3, 1); rightFoot.stroke(outline);
      player.addChild(rightFoot);
      const torso = new Graphics();
      torso.roundRect(-10, -6, 20, 18, 8); torso.fill(0x3b82f6); torso.roundRect(-10, -6, 20, 18, 8); torso.stroke(outline);
      player.addChild(torso);
      const leftArm = new Graphics();
      leftArm.roundRect(-13, -2, 6, 14, 3); leftArm.fill(0xfec89a); leftArm.roundRect(-13, -2, 6, 14, 3); leftArm.stroke(outline);
      player.addChild(leftArm);
      const rightArm = new Graphics();
      rightArm.roundRect(7, -2, 6, 14, 3); rightArm.fill(0xfec89a); rightArm.roundRect(7, -2, 6, 14, 3); rightArm.stroke(outline);
      player.addChild(rightArm);
      const head = new Graphics();
      head.circle(0, -22, 13); head.fill(0xfec89a); head.circle(0, -22, 13); head.stroke(outline);
      player.addChild(head);
      const hair = new Graphics();
      hair.ellipse(0, -30, 11, 6); hair.fill(0x1e293b); hair.ellipse(0, -30, 11, 6); hair.stroke(outline);
      player.addChild(hair);
      const backpack = new Graphics();
      backpack.roundRect(-11, -4, 8, 14, 4); backpack.fill(0x4f46e5); backpack.roundRect(-11, -4, 8, 14, 4); backpack.stroke(outline);
      player.addChild(backpack);

      const playerIdleFrames =
        (await loadAnimationFrames('player', 'idle')) ??
        (await loadKenneyCharacterFrames('player', playerCharacterId as any));
      const playerWalkFrames = await loadAnimationFrames('player', 'walk');
      if (!isRenderActive()) return;

      if ((playerIdleFrames && playerIdleFrames.length > 0) || (playerWalkFrames && playerWalkFrames.length > 0)) {
        player.removeChildren();
        player.scale.set(1);
        const ps2 = new Graphics(); ps2.ellipse(0, 0, 10, 5); ps2.fill({ color: 0x000000, alpha: 0.2 }); player.addChild(ps2);
        const idleFrames = (playerIdleFrames && playerIdleFrames.length > 0) ? playerIdleFrames : (playerWalkFrames || []);
        playerSprite = new AnimatedSprite(idleFrames);
        playerSprite.anchor.set(0.5, 1);
        playerSprite.scale.set(characterTargetHeight / Math.max(idleFrames[0]?.height || 1, 1));
        playerSprite.animationSpeed = idleFrames.length > 1 ? 0.16 : 0;
        if (idleFrames.length > 1) playerSprite.play();
        player.addChild(playerSprite);
      }

      // Name label above player — outlined game-style text
      const playerLabelY = -(characterTargetHeight + 8);
      const playerLabelStroke = new Text({ text: displayName || 'Player', style: new TextStyle({
        fontSize: 14, fill: '#1a1a2e', fontFamily: 'Arial', fontWeight: 'bold',
        stroke: { color: 0x1a1a2e, width: 5, join: 'round' },
      }) });
      playerLabelStroke.anchor.set(0.5, 1); playerLabelStroke.position.set(0, playerLabelY);
      const playerLabelFill = new Text({ text: displayName || 'Player', style: new TextStyle({
        fontSize: 14, fill: '#fef9c3', fontFamily: 'Arial', fontWeight: 'bold',
      }) });
      playerLabelFill.anchor.set(0.5, 1); playerLabelFill.position.set(0, playerLabelY);
      player.addChild(playerLabelStroke, playerLabelFill);

      scrollContainer.addChild(player);

      // ── Draw doctor ────────────────────────────────────────────────────────
      const doctor = new Container();
      doctor.eventMode = 'static'; doctor.cursor = 'pointer';
      doctor.on('pointertap', () => (window as any).__openDoctorChat?.());
      const addDoctorCue = (target: Container, x: number, y: number) => {
        const cue = new Container();
        cue.position.set(x, y);
        const cueTail = new Graphics();
        cueTail.moveTo(-4, 9);
        cueTail.lineTo(5, 18);
        cueTail.lineTo(10, 8);
        cueTail.closePath();
        cueTail.fill({ color: 0xf8fafc, alpha: 0.96 });
        cueTail.stroke({ color: 0x38bdf8, width: 1.5, alpha: 0.65 });
        const cueBg = new Graphics();
        cueBg.roundRect(-24, -14, 48, 24, 10);
        cueBg.fill({ color: 0xf8fafc, alpha: 0.96 });
        cueBg.stroke({ color: 0x38bdf8, width: 2, alpha: 0.8 });
        const cueText = new Text({
          text: 'ASK',
          style: new TextStyle({
            fontSize: 11,
            fill: '#0f172a',
            fontFamily: 'Arial',
            fontWeight: 'bold',
          }),
        });
        cueText.anchor.set(0.5);
        cueText.position.set(0, -2);
        cue.addChild(cueTail, cueBg, cueText);
        target.addChild(cue);
      };
      let pulseIndicator: Graphics;
      let clickableGlow: Graphics;
      const docOutline = { color: 0x000000, width: 2.5 };
      doctor.scale.set(2);

      const dShadow = new Graphics(); dShadow.ellipse(0, 0, 12, 6); dShadow.fill({ color: 0x000000, alpha: 0.25 }); doctor.addChild(dShadow);
      const dLL = new Graphics(); dLL.roundRect(-9, 20, 7, 11, 3); dLL.fill(0x1e293b); dLL.roundRect(-9, 20, 7, 11, 3); dLL.stroke(docOutline); doctor.addChild(dLL);
      const dRL = new Graphics(); dRL.roundRect(2, 20, 7, 11, 3); dRL.fill(0x1e293b); dRL.roundRect(2, 20, 7, 11, 3); dRL.stroke(docOutline); doctor.addChild(dRL);
      const dBody = new Graphics(); dBody.roundRect(-13, -10, 26, 30, 8); dBody.fill(0xffffff); dBody.roundRect(-13, -10, 26, 30, 8); dBody.stroke(docOutline); dBody.roundRect(-8, -9, 16, 5, 2); dBody.fill({ color: 0x99d6ea, alpha: 0.95 }); doctor.addChild(dBody);
      const dLA = new Graphics(); dLA.roundRect(-16, -6, 6, 18, 3); dLA.fill(0xfec89a); dLA.roundRect(-16, -6, 6, 18, 3); dLA.stroke(docOutline); doctor.addChild(dLA);
      const dRA = new Graphics(); dRA.roundRect(10, -6, 6, 18, 3); dRA.fill(0xfec89a); dRA.roundRect(10, -6, 6, 18, 3); dRA.stroke(docOutline); doctor.addChild(dRA);
      const dHead = new Graphics(); dHead.circle(0, -26, 14); dHead.fill(0xfdb68a); dHead.circle(0, -26, 14); dHead.stroke(docOutline); doctor.addChild(dHead);
      const dMirror = new Graphics(); dMirror.roundRect(-14, -44, 28, 5, 2); dMirror.fill(0xcbd5e1); dMirror.roundRect(-14, -44, 28, 5, 2); dMirror.stroke(docOutline); dMirror.circle(0, -46, 6); dMirror.fill(0xf1f5f9); dMirror.circle(0, -46, 6); dMirror.stroke(docOutline); doctor.addChild(dMirror);
      const dSteth = new Graphics(); dSteth.roundRect(-2.5, 2, 5, 14, 2); dSteth.stroke({ color: 0x64748b, width: 2.5 }); dSteth.circle(0, 17, 4); dSteth.stroke({ color: 0x64748b, width: 2.5 }); dSteth.circle(0, 17, 1.5); dSteth.fill(0x94a3b8); doctor.addChild(dSteth);
      clickableGlow = new Graphics(); clickableGlow.circle(0, 0, 35); clickableGlow.fill({ color: 0x3b82f6, alpha: 0.15 }); doctor.addChildAt(clickableGlow, 0);
      pulseIndicator = new Graphics(); pulseIndicator.circle(0, 18, 2); pulseIndicator.fill({ color: 0xef4444, alpha: 0.8 }); doctor.addChild(pulseIndicator);
      addDoctorCue(doctor, 24, -52);

      const doctorFrames =
        (await loadAnimationFrames('doctor', 'idle')) ??
        (await loadKenneyCharacterFrames('doctor'));
      if (!isRenderActive()) return;

      if (doctorFrames && doctorFrames.length > 0) {
        doctor.removeChildren(); doctor.scale.set(1);
        clickableGlow = new Graphics(); clickableGlow.circle(0, 0, 40); clickableGlow.fill({ color: 0x3b82f6, alpha: 0.13 }); doctor.addChild(clickableGlow);
        const ds2 = new Graphics(); ds2.ellipse(0, 0, 10, 5); ds2.fill({ color: 0x000000, alpha: 0.2 }); doctor.addChild(ds2);
        const dSpr = new AnimatedSprite(doctorFrames); dSpr.anchor.set(0.5, 1); dSpr.scale.set(characterTargetHeight / Math.max(doctorFrames[0].height || 1, 1)); dSpr.animationSpeed = doctorFrames.length > 1 ? 0.16 : 0; if (doctorFrames.length > 1) dSpr.play(); doctor.addChild(dSpr);
        pulseIndicator = new Graphics(); pulseIndicator.circle(0, 20, 2.2); pulseIndicator.fill({ color: 0xef4444, alpha: 0.8 }); doctor.addChild(pulseIndicator);
        addDoctorCue(doctor, 28, -(characterTargetHeight + 28));
      }

      // Name label above doctor — outlined game-style text
      const doctorLabelY = -(characterTargetHeight + 8);
      const doctorLabelStroke = new Text({ text: 'Dr. Gemma', style: new TextStyle({
        fontSize: 14, fill: '#1a1a2e', fontFamily: 'Arial', fontWeight: 'bold',
        stroke: { color: 0x1a1a2e, width: 5, join: 'round' },
      }) });
      doctorLabelStroke.anchor.set(0.5, 1); doctorLabelStroke.position.set(0, doctorLabelY);
      const doctorLabelFill = new Text({ text: 'Dr. Gemma', style: new TextStyle({
        fontSize: 14, fill: '#bae6fd', fontFamily: 'Arial', fontWeight: 'bold',
      }) });
      doctorLabelFill.anchor.set(0.5, 1); doctorLabelFill.position.set(0, doctorLabelY);
      doctor.addChild(doctorLabelStroke, doctorLabelFill);

      const doctorContainer = new Container();
      doctorContainer.addChild(doctor); doctorContainer.zIndex = 1000;
      scrollContainer.addChild(doctorContainer);

      // ── Intro walk animation (first time per consultation) ─────────────────
      if (introMessage) {
        const originalPlayerX = player.position.x;
        const originalDoctorX = doctorContainer.position.x + doctor.position.x;
        const startOffset = Math.min(220, width * 0.48);
        player.position.x = originalPlayerX - startOffset;
        doctorContainer.position.x -= startOffset;

        const bubble = new Graphics();
        // Slightly wider & taller to avoid text clipping on mobile
        const bubbleWidth = 240;
        const bubbleHeight = 80;
        const bubbleY = -(characterTargetHeight + 90);
        bubble.roundRect(-bubbleWidth / 2, bubbleY, bubbleWidth, bubbleHeight, 12);
        bubble.fill({ color: 0x020617, alpha: 0.96 });
        bubble.stroke({ color: 0x38bdf8, width: 2 });

        const bubbleText = new Text({
          text: introMessage,
          style: new TextStyle({
            fontSize: 13,
            fill: '#e5e7eb',
            fontFamily: 'Arial',
            wordWrap: true,
            wordWrapWidth: bubbleWidth - 20,
            lineHeight: 19,
          }),
        });
        bubbleText.anchor.set(0.5, 0.5);
        bubbleText.position.set(0, bubbleY + bubbleHeight / 2);

        const bubbleContainer = new Container();
        bubbleContainer.addChild(bubble);
        bubbleContainer.addChild(bubbleText);
        doctorContainer.addChild(bubbleContainer);

        let elapsed = 0;
        const durationMs = 4000;

        const introTicker = (_ticker: any) => {
          if (!isRenderActive()) {
            app.ticker.remove(introTicker);
            return;
          }
          elapsed += (app.ticker.deltaMS || 16.67);
          const t = Math.min(1, elapsed / durationMs);
          const ease = 1 - Math.pow(1 - t, 3);
          player.position.x = originalPlayerX - startOffset + startOffset * ease;
          doctorContainer.position.x = originalDoctorX - startOffset + startOffset * ease;

          if (t >= 1) {
            app.ticker.remove(introTicker);

            let fadeElapsed = 0;
            const fadeDuration = 1200;
            const fadeTicker = (_t: any) => {
              if (!isRenderActive()) {
                app.ticker.remove(fadeTicker);
                return;
              }
              fadeElapsed += (app.ticker.deltaMS || 16.67);
              const ft = Math.min(1, fadeElapsed / fadeDuration);
              bubbleContainer.alpha = 1 - ft;
              if (ft >= 1) {
                app.ticker.remove(fadeTicker);
                doctorContainer.removeChild(bubbleContainer);
              }
            };
            app.ticker.add(fadeTicker);
          }
        };

        app.ticker.add(introTicker);
      }

      // ── Initial character positions ────────────────────────────────────────
      const progressIdx = Math.max(-1, Math.min(completed - 1, starCount - 1));
      const mapKey = `river:${starCount}:${total}`;
      if (lastMapKeyRef.current !== mapKey) { lastMapKeyRef.current = mapKey; lastCompletedRef.current = progressIdx; }
      const previousProgress = Math.max(-1, Math.min(lastCompletedRef.current, starCount - 1));
      const shouldPlayWalk = progressIdx > previousProgress;
      lastCompletedRef.current = progressIdx;

      const startPos = getPlayerPos(previousProgress);
      const currentPos = getPlayerPos(progressIdx);
      let x = shouldPlayWalk ? startPos.x : currentPos.x;
      let y = shouldPlayWalk ? startPos.y : currentPos.y;
      let targetX = currentPos.x;
      let targetY = currentPos.y;
      const walkDurationMs = 2000;
      const walkStart = performance.now();
      let isWalkingToNext = shouldPlayWalk;
      let isPlayerWalkingAnim = shouldPlayWalk;
      player.position.set(x, y);

      // Doctor trails one star behind, on the opposite (right) side
      const docStartPos = getDoctorPos(previousProgress);
      const docCurrentPos = getDoctorPos(progressIdx);
      let docX = shouldPlayWalk ? docStartPos.x : docCurrentPos.x;
      let docY = shouldPlayWalk ? docStartPos.y : docCurrentPos.y;
      let docTargetX = docCurrentPos.x;
      let docTargetY = docCurrentPos.y;
      doctorContainer.position.set(docX, docY);

      // ── Animation ticker ───────────────────────────────────────────────────
      let tick = 0;
      app.ticker.add(() => {
        if (!isRenderActive()) return;
        tick += 0.03;
        const liveIdx = Math.max(-1, Math.min(completed - 1, starCount - 1));
        const livePos = getPlayerPos(liveIdx);
        targetX = livePos.x; targetY = livePos.y;
        const liveDocPos = getDoctorPos(liveIdx);
        docTargetX = liveDocPos.x; docTargetY = liveDocPos.y;

        if (isWalkingToNext) {
          const t = Math.min(1, (performance.now() - walkStart) / walkDurationMs);
          x = startPos.x + (targetX - startPos.x) * t;
          y = startPos.y + (targetY - startPos.y) * t;
          docX = docStartPos.x + (docTargetX - docStartPos.x) * t;
          docY = docStartPos.y + (docTargetY - docStartPos.y) * t;
          if (t >= 1) { isWalkingToNext = false; isPlayerWalkingAnim = false; }
        } else {
          x += (targetX - x) * 0.12; y += (targetY - y) * 0.12;
          docX += (docTargetX - docX) * 0.08; docY += (docTargetY - docY) * 0.08;
        }

        const bob = isWalkingToNext ? Math.sin(tick * 7) * 1.1 : 0;
        const breathe = Math.sin(tick * 2.1);
        const walk = Math.sin(tick * 4.5);
        player.position.set(x, y + bob);
        player.rotation = isWalkingToNext ? Math.sin(tick * 1.2) * 0.02 : 0;

        if (playerSprite && playerWalkFrames && playerWalkFrames.length > 1 && playerIdleFrames && playerIdleFrames.length > 0) {
          if (isPlayerWalkingAnim) {
            if (playerSprite.textures !== playerWalkFrames) { playerSprite.textures = playerWalkFrames; playerSprite.animationSpeed = 0.22; playerSprite.play(); }
          } else if (playerSprite.textures !== playerIdleFrames) {
            playerSprite.textures = playerIdleFrames; playerSprite.animationSpeed = playerIdleFrames.length > 1 ? 0.16 : 0;
            if (playerIdleFrames.length > 1) playerSprite.play(); else playerSprite.gotoAndStop(0);
          }
        }

        if (player.children.length > 2) {
          leftLeg.rotation = walk * 0.15; rightLeg.rotation = -walk * 0.15;
          leftArm.rotation = -walk * 0.2; rightArm.rotation = walk * 0.2;
          torso.scale.y = 1 + breathe * 0.03; head.y = -18 + breathe * 0.6; hair.y = -24 + breathe * 0.5;
        }

        doctorContainer.position.set(docX, docY + bob * 0.6);

        for (const fc of floatingCoins) {
          const floatY = Math.sin(tick * 0.7 + fc.phaseOffset) * 5;
          fc.container.y = fc.baseY + floatY;
          const sh = (fc.container as any)._shadow as Graphics | undefined;
          if (sh) {
            const sc = 1 - Math.abs(floatY) * 0.025;
            sh.scale.set(sc, sc);
          }
        }

        checkpointContainer.children.forEach((child: any) => {
          if (child._isCurrent && child._isCurrentGlow) {
            const p = Math.sin(tick * 2.2) * 0.5 + 0.5;
            child._isCurrentGlow.scale.set(1 + p * 0.22); child._isCurrentGlow.alpha = 0.4 + p * 0.45;
          }
        });

        const p = Math.sin(tick * 6) * 0.5 + 0.5;
        pulseIndicator.scale.set(1 + p * 0.3); pulseIndicator.alpha = 0.6 + p * 0.4;
        clickableGlow.alpha = 0.08 + Math.sin(tick * 3) * 0.05;
      });
    },
    [onCheckpointClick, checklistItems, eventsPerStar, loadAnimationFrames, loadKenneyCharacterFrames, userName, playerCharacterId]
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const initApp = async () => {
      if (appRef.current) { appRef.current.destroy(true); appRef.current = null; }
      const app = new Application();
      let lastWidth = 0, lastHeight = 0;
      const updateSize = () => {
        if (!containerRef.current || !appRef.current) return;
        const w = containerRef.current.clientWidth, h = containerRef.current.clientHeight;
        if (Math.abs(w - lastWidth) > 10 || Math.abs(h - lastHeight) > 10 || lastWidth === 0) {
          lastWidth = w; lastHeight = h; appRef.current.renderer.resize(w, h);
          drawMap(appRef.current, getTheme(theme), completedCount, totalCount, mapSpec, userName).catch(console.error);
        } else { appRef.current.renderer.resize(w, h); }
      };
      await app.init({ width: containerRef.current!.clientWidth, height: containerRef.current!.clientHeight, backgroundAlpha: 0, antialias: true, resolution: window.devicePixelRatio || 1, autoDensity: true });
      containerRef.current!.innerHTML = '';
      containerRef.current!.appendChild(app.canvas as HTMLCanvasElement);
      appRef.current = app; lastWidth = containerRef.current!.clientWidth; lastHeight = containerRef.current!.clientHeight;
      drawMap(app, getTheme(theme), completedCount, totalCount, mapSpec, userName).catch(console.error);

      let touchStartY = 0, isDragging = false;
      const handleTouchStart = (e: TouchEvent) => { if (scrollContainerRef.current) { touchStartY = e.touches[0].clientY; isDragging = true; } };
      const handleTouchMove = (e: TouchEvent) => { if (!isDragging || !scrollContainerRef.current) return; e.preventDefault(); const dy = touchStartY - e.touches[0].clientY; touchStartY = e.touches[0].clientY; scrollYRef.current = Math.max(0, Math.min(maxScrollYRef.current, scrollYRef.current + dy)); scrollContainerRef.current.y = -scrollYRef.current; };
      const handleTouchEnd = () => { isDragging = false; };
      const handleWheel = (e: WheelEvent) => { if (scrollContainerRef.current) { e.preventDefault(); scrollYRef.current = Math.max(0, Math.min(maxScrollYRef.current, scrollYRef.current + e.deltaY)); scrollContainerRef.current.y = -scrollYRef.current; } };

      const canvas = app.canvas as HTMLCanvasElement;
      canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
      canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
      canvas.addEventListener('touchend', handleTouchEnd);
      canvas.addEventListener('wheel', handleWheel, { passive: false });
      (app as any).__touchHandlers = { handleTouchStart, handleTouchMove, handleTouchEnd, handleWheel };

      const resizeObserver = new ResizeObserver(() => updateSize());
      if (containerRef.current) resizeObserver.observe(containerRef.current);
      const handleWindowResize = () => { clearTimeout((window as any).__gameCanvasResizeTimeout); (window as any).__gameCanvasResizeTimeout = setTimeout(() => updateSize(), 100); };
      window.addEventListener('resize', handleWindowResize); window.addEventListener('orientationchange', handleWindowResize);
      (app as any).__resizeObserver = resizeObserver; (app as any).__resizeHandler = handleWindowResize;
    };
    initApp();
    return () => {
      if (appRef.current) {
        if ((appRef.current as any).__resizeObserver) (appRef.current as any).__resizeObserver.disconnect();
        if ((appRef.current as any).__resizeHandler) { window.removeEventListener('resize', (appRef.current as any).__resizeHandler); window.removeEventListener('orientationchange', (appRef.current as any).__resizeHandler); }
        if ((appRef.current as any).__touchHandlers) { const c = appRef.current.canvas as HTMLCanvasElement; const h = (appRef.current as any).__touchHandlers; c.removeEventListener('touchstart', h.handleTouchStart); c.removeEventListener('touchmove', h.handleTouchMove); c.removeEventListener('touchend', h.handleTouchEnd); c.removeEventListener('wheel', h.handleWheel); }
        appRef.current.destroy(true); appRef.current = null;
      }
    };
  }, [theme, completedCount, totalCount, mapSpec, drawMap, userName]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden shadow-inner"
      style={{
        background:
          'radial-gradient(circle at 20% 10%, rgba(186,230,253,0.22), transparent 18rem), linear-gradient(180deg, #446f9b 0%, #5b8db5 100%)',
      }}
    />
  );
}

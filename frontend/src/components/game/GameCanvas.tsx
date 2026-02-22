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
  ColorMatrixFilter,
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
  /** Events per star (one star can have multiple events); length = number of nodes */
  eventsPerStar?: ChecklistItem[][];
  onCheckpointClick?: (index: number) => void;
}

export default function GameCanvas({
  theme,
  completedCount,
  totalCount,
  mapSpec,
  checklistItems = [],
  eventsPerStar,
  onCheckpointClick,
}: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const renderSeqRef = useRef(0);
  const lastCompletedRef = useRef(0);
  const lastMapKeyRef = useRef('');
  const scrollContainerRef = useRef<Container | null>(null);
  const scrollYRef = useRef(0);
  const maxScrollYRef = useRef(0);

  /** Render actual Kenney GLB models into lightweight sprite sheets (cached). */
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
    async (characterId: 'player' | 'doctor'): Promise<Texture[] | null> => {
      const assetPath =
        characterId === 'doctor'
          ? '/kenney_blocky-characters_20/Previews/character-i.png'
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
      themeData: GameTheme,
      completed: number,
      total: number,
      dynamicSpec?: PersonalizedMapSpec | null
    ) => {
      const renderSeq = ++renderSeqRef.current;
      const isRenderActive = () => appRef.current === app && renderSeqRef.current === renderSeq && !!app.stage;
      if (!isRenderActive()) return;

      const { width, height } = app.screen;

      // Clear existing children
      while (app.stage.children.length > 0) {
        app.stage.removeChildAt(0);
      }
      // Reset scroll state each render
      scrollContainerRef.current = null;
      scrollYRef.current = 0;
      maxScrollYRef.current = 0;

      // ─────────────────────────────────────────────────────────────────────────
      // KENNEY-REFERENCE ELEVATION MAP — close replication of Kenney island demo
      //
      // Key principles from the Kenney reference image:
      //   - Dramatic 3D cliffs: each cell stacks 1-4 _full tiles, showing thick sides
      //   - Water at edges (elev 0), land rises center-high
      //   - 3 biome zones: Desert (bottom) → Jungle (middle) → Icy (top)
      //   - Large, prominent decorations on top surfaces
      //   - Grid fully covers viewport width (no bare sky on sides)
      // ─────────────────────────────────────────────────────────────────────────

      const starCount = Math.max(total, 2);

      // ── Grid geometry ────────────────────────────────────────────────────────
      // 9 cols fills the width; tiles are wider for drama
      const GRID_COLS = 9;
      // Slightly overlap tiles so no gaps; 0.72 overlap factor fills width tightly
      const tileW = Math.floor(width / (GRID_COLS * 0.72 + 0.28)) + 2;
      const tileH = Math.floor(tileW * 1.15);
      // How much each stacked tile peeks above the one below (makes cliffs thick/dramatic)
      // Larger = more 3D cliff height visible
      const STACK_H = Math.floor(tileH * 0.55);
      // Row-to-row vertical advance (tight interlocking)
      const rowStep = Math.floor(tileH * 0.56);

      // ── Map height ───────────────────────────────────────────────────────────
      const STEP_RISE = Math.min(Math.max(Math.floor(height / 5), 100), 160);
      const PADDING_TOP = 120;
      const PADDING_BOT = 140;
      const mapHeight = starCount * STEP_RISE + PADDING_TOP + PADDING_BOT + height * 0.4;
      const totalTileRows = Math.ceil(mapHeight / rowStep) + 6;

      // ── Scroll container ─────────────────────────────────────────────────────
      const scrollContainer = new Container();
      scrollContainerRef.current = scrollContainer;
      maxScrollYRef.current = Math.max(0, mapHeight - height);
      scrollYRef.current = maxScrollYRef.current;
      scrollContainer.y = -scrollYRef.current;

      const mask = new Graphics();
      mask.rect(0, 0, width, height);
      mask.fill(0xffffff);
      app.stage.addChild(mask);
      scrollContainer.mask = mask;
      app.stage.addChild(scrollContainer);

      // ── Load textures ────────────────────────────────────────────────────────
      const T = '/kenney_hexagon-tiles/Tiles/';
      const loadTex = (p: string) => Assets.load(p).catch(() => null) as Promise<Texture | null>;

      const [
        texGrass, texDirt, texSand, texSnow, texStone, texWater, texRock,
        texWaterFlat,
        texTreeGreenLow, texTreeGreenMid, texTreeGreenHigh, texPineGreenLow, texPineGreenMid, texPineGreenHigh,
        texTreeAutumnLow, texCactus1, texCactus2,
        texRockSnow, texSmallRockSnow, texSmallRockGrass,
        texBushGrass, texBushSand, texBushSnow,
        texHillGrass, texHillSand, texHillSnow,
        texFlowerRed, texFlowerYellow,
        chainTexture,
      ] = await Promise.all([
        loadTex(`${T}tileGrass_full.png`), loadTex(`${T}tileDirt_full.png`),
        loadTex(`${T}tileSand_full.png`),  loadTex(`${T}tileSnow_full.png`),
        loadTex(`${T}tileStone_full.png`), loadTex(`${T}tileWater_full.png`),
        loadTex(`${T}tileRock_full.png`),
        loadTex(`${T}tileWater.png`),
        loadTex(`${T}treeGreen_low.png`),  loadTex(`${T}treeGreen_mid.png`), loadTex(`${T}treeGreen_high.png`),
        loadTex(`${T}pineGreen_low.png`),  loadTex(`${T}pineGreen_mid.png`), loadTex(`${T}pineGreen_high.png`),
        loadTex(`${T}treeAutumn_low.png`), loadTex(`${T}treeCactus_1.png`),
        loadTex(`${T}treeCactus_2.png`),
        loadTex(`${T}rockSnow_1.png`),     loadTex(`${T}smallRockSnow.png`),
        loadTex(`${T}smallRockGrass.png`),
        loadTex(`${T}bushGrass.png`),      loadTex(`${T}bushSand.png`),
        loadTex(`${T}bushSnow.png`),
        loadTex(`${T}hillGrass.png`),      loadTex(`${T}hillSand.png`),
        loadTex(`${T}hillSnow.png`),
        loadTex(`${T}flowerRed.png`),      loadTex(`${T}flowerYellow.png`),
        Assets.load('/chains.png').catch(() => null) as Promise<Texture | null>,
      ]);

      if (!isRenderActive()) return;

      // ── Helpers ──────────────────────────────────────────────────────────────
      const hash = (a: number, b: number) => {
        let h = ((a * 1664525 + b * 1013904223) ^ (a << 16)) & 0xffffffff;
        return (h >>> 0) / 0xffffffff;
      };

      const hexPos = (row: number, col: number) => {
        const x = col * tileW * 0.76 + (row % 2 === 1 ? tileW * 0.38 : 0) + tileW / 2;
        const y = row * rowStep + tileH / 2;
        return { x, y };
      };

      // Biome: 0=desert, 1=jungle, 2=icy based on Y position (bottom=desert, top=icy)
      const getBiome = (y: number): 0 | 1 | 2 => {
        const frac = 1 - y / mapHeight;
        if (frac < 0.33) return 0;
        if (frac < 0.66) return 1;
        return 2;
      };

      // ── Height map ────────────────────────────────────────────────────────────
      // Profile: center high (elev 3-4), edges water (0), beach at col 2 & 6 (elev 1)
      // This creates the island ridge look from the Kenney reference:
      //   col:  0   1   2   3   4   5   6   7   8
      //        [0] [0] [1] [2] [3] [2] [1] [0] [0]
      const BASE_ELEV = [0, 0, 1, 2, 3, 2, 1, 0, 0];

      // Zigzag star positions — use 35/65% of width so they're always on-screen
      const STEP_LEFT_X  = width * 0.32;
      const STEP_RIGHT_X = width * 0.68;
      // Coin floats this many pixels above the platform top
      const COIN_ABOVE   = STACK_H * 2 + 30;

      const starPixels: { x: number; y: number }[] = [];
      for (let i = 0; i < starCount; i++) {
        const stepY = mapHeight - PADDING_BOT - i * STEP_RISE;
        const stepX = (i % 2 === 0) ? STEP_RIGHT_X : STEP_LEFT_X;
        starPixels.push({ x: stepX, y: stepY - COIN_ABOVE });
      }

      const startFlagPixel = { x: width * 0.5, y: mapHeight - PADDING_BOT + 30 };
      const endFlagPixel = {
        x: (starCount % 2 === 0) ? STEP_RIGHT_X : STEP_LEFT_X,
        y: PADDING_TOP,
      };

      // Build the 2D height map
      const heightMap: number[][] = [];
      for (let row = 0; row < totalTileRows; row++) {
        const rowElev: number[] = [];
        const { y: rowY } = hexPos(row, 0);
        const biomeForRow = getBiome(rowY);
        // Gradual +1 boost toward top of map (climbing feel)
        const climbBoost = rowY < mapHeight * 0.4 ? 1 : 0;

        for (let col = 0; col < GRID_COLS; col++) {
          let elev = BASE_ELEV[col] + climbBoost;
          // Per-cell organic variation: +1 on ~30% cells, -1 on ~20%
          const hv = hash(row * 17 + col * 3, row * 7 + col * 11);
          if (col >= 2 && col <= GRID_COLS - 3) {
            elev += hv < 0.2 ? -1 : hv > 0.75 ? 1 : 0;
          }
          // Add occasional jungle lakes (like the reference map) on low-mid elevations.
          if (biomeForRow === 1 && col >= 2 && col <= GRID_COLS - 3) {
            const lakeHv = hash(row * 53 + col * 17, row * 29 + col * 31);
            if (lakeHv < 0.08 && elev <= 2) elev = 0;
          }
          // Edge water columns always 0
          if (col <= 1 || col >= GRID_COLS - 2) elev = 0;
          // Beach columns: max 2
          else if (col === 2 || col === GRID_COLS - 3) elev = Math.min(elev, 2);
          elev = Math.max(0, Math.min(4, elev));
          rowElev.push(elev);
        }
        heightMap.push(rowElev);
      }

      // ── Surface tile textures per biome + elevation ──────────────────────────
      // Reference image: desert=sand+dirt sides, jungle=grass+dirt sides, icy=snow+stone
      const getSurfaceTex = (biome: 0 | 1 | 2, elev: number, hv: number): Texture | null => {
        if (biome === 0) {
          // Desert: beach/sand at low, dirt-sand mixed at high
          if (elev <= 1) return texSand;
          return hv < 0.55 ? texSand : texDirt;
        } else if (biome === 1) {
          // Jungle: grass on top, transition dirt on beach
          if (elev <= 1) return hv < 0.75 ? texGrass : texDirt;
          return texGrass;
        } else {
          // Icy: snow at lower, stone/rock at summit
          if (elev <= 2) return texSnow;
          return hv < 0.5 ? texSnow : texStone;
        }
      };

      // Side tile (the "cliff wall" tiles below surface) — dirt for all biomes except icy
      const getSideTex = (biome: 0 | 1 | 2): Texture | null => {
        if (biome === 2) return texStone;
        return texDirt;
      };

      // ── Render background sky ─────────────────────────────────────────────────
      // Light blue sky gradient behind everything
      const skyBg = new Graphics();
      skyBg.rect(0, 0, width + 20, mapHeight + 200);
      skyBg.fill(0x87ceeb); // sky blue
      scrollContainer.addChild(skyBg);

      const tileLayer = new Container();

      // IMPORTANT: Draw rows top-to-bottom so painter's algorithm works
      // Within each row: draw stacked tiles for each col so higher elevation blocks
      // appear in front of lower neighbours (each tile slightly overlaps the one above)
      for (let row = 0; row < totalTileRows; row++) {
        for (let col = 0; col < GRID_COLS; col++) {
          const { x, y } = hexPos(row, col);
          const elev = heightMap[row][col];
          const biome = getBiome(y);
          const hv = hash(row * 23 + col * 7, row * 11 + col * 3);

          if (elev === 0) {
            // Water — use flat water tile (no sides)
            const tex = texWaterFlat || texWater;
            if (tex) {
              const spr = new Sprite(tex);
              spr.anchor.set(0.5, 0.5);
              spr.scale.set(tileW / tex.width * 1.05);
              spr.position.set(x, y);
              tileLayer.addChild(spr);
            }
          } else {
            // Land: stack `elev` full tiles bottom-to-top
            // s=0 is bottommost visible (deepest cliff face), s=elev-1 is surface
            const surfTex = getSurfaceTex(biome, elev, hv);
            const sideTex = getSideTex(biome);
            for (let s = 0; s < elev; s++) {
              const isTop = s === elev - 1;
              const tex = isTop ? surfTex : sideTex;
              // Each successive tile shifted UP by STACK_H pixels
              const yOff = -(s * STACK_H);
              if (tex) {
                const spr = new Sprite(tex);
                spr.anchor.set(0.5, 0.5);
                spr.scale.set(tileW / tex.width * 1.05);
                spr.position.set(x, y + yOff);
                tileLayer.addChild(spr);
              }
            }
          }
        }
      }
      scrollContainer.addChild(tileLayer);

      // ── Decorations: placed on top surface of each land cell ─────────────────
      // Anchored at (0.5, 1) — bottom-center on the tile's top face
      // topY = base y - (elev-1)*STACK_H - half the tile face height
      const decorLayer = new Container();
      for (let row = 0; row < totalTileRows; row++) {
        for (let col = 0; col < GRID_COLS; col++) {
          const elev = heightMap[row][col];
          if (elev < 1) continue;
          // Avoid the two center columns where path zigzags (cols 3,4,5)
          if (col >= 3 && col <= 5) continue;

          const { x, y } = hexPos(row, col);
          const biome = getBiome(y);
          const h1 = hash(row * 41 + col * 13, row * 7 + col * 29);
          const h2 = hash(row * 19 + col * 37, row * 23 + col * 11);

          // Balanced density to avoid repeated vertical columns.
          if (h1 > 0.3) continue;

          // Top face Y: base y moved up by stacked height + half the top face
          const topFaceY = y - (elev - 1) * STACK_H - tileH * 0.25;

          let propTex: Texture | null = null;
          // Scale relative to tileW — trees should be 1.5-2x tileW tall for visibility
          let sc = 1.1;

          if (biome === 0) { // desert
            if (h2 < 0.2) { propTex = texCactus1; sc = 1.05; }
            else if (h2 < 0.35) { propTex = texCactus2; sc = 0.95; }
            else if (h2 < 0.55) { propTex = texBushSand; sc = 0.62; }
            else if (h2 < 0.72) { propTex = texHillSand; sc = 0.74; }
            else { propTex = texSmallRockGrass; sc = 0.58; }
          } else if (biome === 1) { // jungle
            if (h2 < 0.1) { propTex = texTreeGreenHigh; sc = 1.32; }
            else if (h2 < 0.2) { propTex = texTreeGreenMid; sc = 1.2; }
            else if (h2 < 0.3) { propTex = texTreeGreenLow; sc = 1.08; }
            else if (h2 < 0.4) { propTex = texPineGreenHigh; sc = 1.24; }
            else if (h2 < 0.5) { propTex = texPineGreenMid; sc = 1.14; }
            else if (h2 < 0.62) { propTex = texPineGreenLow; sc = 1.04; }
            else if (h2 < 0.74) { propTex = texBushGrass; sc = 0.64; }
            else if (h2 < 0.84) { propTex = texHillGrass; sc = 0.72; }
            else if (h2 < 0.92) { propTex = texFlowerYellow; sc = 0.42; }
            else { propTex = texFlowerRed; sc = 0.42; }
          } else { // icy
            if (h2 < 0.16) { propTex = texPineGreenHigh; sc = 1.22; }
            else if (h2 < 0.28) { propTex = texPineGreenMid; sc = 1.12; }
            else if (h2 < 0.42) { propTex = texPineGreenLow; sc = 1.0; }
            else if (h2 < 0.58) { propTex = texRockSnow; sc = 0.74; }
            else if (h2 < 0.74) { propTex = texSmallRockSnow; sc = 0.56; }
            else { propTex = texBushSnow; sc = 0.6; }
          }

          if (!propTex) continue;
          const spr = new Sprite(propTex);
          spr.anchor.set(0.5, 1);
          spr.scale.set((tileW * sc) / propTex.width);
          // Slight jitter so they don't all look grid-aligned
          spr.position.set(x + (h2 - 0.5) * tileW * 0.35, topFaceY);
          if (biome === 2 && (propTex === texPineGreenHigh || propTex === texPineGreenLow)) {
            spr.tint = 0xddeeff; // icy tint on trees
          }
          decorLayer.addChild(spr);
        }
      }
      scrollContainer.addChild(decorLayer);

      // ── Dotted path between zigzag steps ─────────────────────────────────────
      const allPathPts = [startFlagPixel, ...starPixels, endFlagPixel];
      const pathGfx = new Graphics();
      const progressGfx = new Graphics();

      for (let i = 0; i < allPathPts.length - 1; i++) {
        const p1 = allPathPts[i];
        const p2 = allPathPts[i + 1];
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const numDots = Math.max(1, Math.floor(dist / 12));

        for (let j = 0; j <= numDots; j++) {
          const t = j / numDots;
          const px = p1.x + dx * t, py = p1.y + dy * t;
          pathGfx.circle(px, py + 1, 4.5); pathGfx.fill({ color: 0x000000, alpha: 0.22 });
          pathGfx.circle(px, py, 4.2);     pathGfx.fill({ color: 0xffffff, alpha: 0.92 });
          pathGfx.circle(px, py - 1.5, 2.5); pathGfx.fill({ color: 0xffffff, alpha: 0.45 });
        }

        const segIdx = i - 1;
        if (segIdx < completed) {
          for (let j = 0; j <= numDots; j++) {
            const t = j / numDots;
            const px = p1.x + dx * t, py = p1.y + dy * t;
            progressGfx.circle(px, py, 4.2);     progressGfx.fill({ color: 0x4ade80, alpha: 1 });
            progressGfx.circle(px, py - 1.2, 2.5); progressGfx.fill({ color: 0x86efac, alpha: 0.7 });
          }
        }
      }
      const pathCont = new Container();
      pathCont.addChild(pathGfx, progressGfx);
      scrollContainer.addChild(pathCont);

      // ── Checkpoint coins ─────────────────────────────────────────────────────
      const checkpointContainer = new Container();
      const floatingCoins: Array<{ container: Container; baseY: number; phaseOffset: number }> = [];
      const COIN_R = Math.min(28, Math.max(18, Math.floor(width * 0.068)));

      const drawStarShape = (g: Graphics, outerR: number, innerR: number) => {
        const pts = 5, stp = Math.PI / pts;
        g.moveTo(0, -outerR);
        for (let p = 1; p <= pts * 2; p++) {
          const angle = p * stp - Math.PI / 2;
          g.lineTo(Math.cos(angle) * (p % 2 === 0 ? outerR : innerR), Math.sin(angle) * (p % 2 === 0 ? outerR : innerR));
        }
        g.closePath();
      };

      for (let index = 0; index < starCount; index++) {
        const { x: cx, y: cy } = starPixels[index];

        const eventsAtStar = eventsPerStar?.[index] ?? (checklistItems[index] ? [checklistItems[index]] : []);
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

        if (isCurrent && !isLocked) {
          const glowG = new Graphics();
          glowG.circle(0, 0, COIN_R + 20); glowG.fill({ color: 0xFF8C42, alpha: 0.14 });
          glowG.circle(0, 0, COIN_R + 12); glowG.fill({ color: 0xFF8C42, alpha: 0.24 });
          glowG.circle(0, 0, COIN_R + 5);  glowG.fill({ color: 0xFF8C42, alpha: 0.38 });
          checkpoint.addChildAt(glowG, 0);
          (checkpoint as any)._isCurrentGlow = glowG;
          (checkpoint as any)._isCurrent = true;
        }

        const shadow = new Graphics();
        shadow.ellipse(0, COIN_R * 0.75, COIN_R * 0.9, COIN_R * 0.25);
        shadow.fill({ color: 0x000000, alpha: 0.22 });
        checkpoint.addChild(shadow);
        (checkpoint as any)._shadow = shadow;

        const coinColor  = isStarCompleted ? 0x4ade80 : isLocked ? 0x6b7280 : 0xFF8C42;
        const innerColor = isStarCompleted ? 0x22c55e : isLocked ? 0x4b5563 : 0xf97316;
        const coin = new Graphics();
        coin.circle(0, 0, COIN_R); coin.fill(coinColor);
        coin.circle(0, 0, COIN_R); coin.stroke({ color: 0xffffff, width: 2.5, alpha: 0.92 });
        coin.circle(0, 0, COIN_R * 0.74); coin.fill({ color: innerColor, alpha: 0.88 });
        checkpoint.addChild(coin);

        const shine = new Graphics();
        shine.ellipse(-COIN_R * 0.28, -COIN_R * 0.3, COIN_R * 0.28, COIN_R * 0.17);
        shine.fill({ color: 0xffffff, alpha: isLocked ? 0.1 : 0.32 });
        checkpoint.addChild(shine);

        const starSym = new Graphics();
        drawStarShape(starSym, COIN_R * 0.46, COIN_R * 0.2);
        starSym.fill({ color: 0xffffff, alpha: isLocked ? 0.3 : 0.95 });
        const starShd = new Graphics();
        drawStarShape(starShd, COIN_R * 0.46, COIN_R * 0.2);
        starShd.fill({ color: 0x000000, alpha: 0.2 });
        starShd.position.set(1, 1.5);
        checkpoint.addChild(starShd, starSym);

        if (isLocked && !isStarCompleted) {
          if (chainTexture) {
            const chain = new Sprite(chainTexture);
            chain.anchor.set(0.5);
            chain.scale.set((COIN_R * 1.1) / Math.max(chainTexture.width, chainTexture.height, 1));
            checkpoint.addChild(chain);
          } else {
            const lt = new Text({ text: '⛓', style: new TextStyle({ fontSize: COIN_R, fontFamily: 'Arial' }) });
            lt.anchor.set(0.5);
            checkpoint.addChild(lt);
          }
        }

        const completedEvent = eventsAtStar.find((e: ChecklistItem) => e.isCompleted);
        if (completedEvent?.title) {
          let titleTxt = completedEvent.title;
          if (titleTxt.length > 18) titleTxt = titleTxt.substring(0, 15) + '...';
          const ts = new TextStyle({ fontSize: 11, fill: isStarCompleted ? '#86efac' : '#ffffff',
            fontFamily: 'Arial', fontWeight: 'bold', dropShadow: true });
          (ts as any).dropShadowColor = 0x000000; (ts as any).dropShadowBlur = 4; (ts as any).dropShadowDistance = 1;
          const lbl = new Text({ text: titleTxt, style: ts });
          lbl.anchor.set(0.5);
          lbl.position.set(0, COIN_R + 14);
          checkpoint.addChild(lbl);
        }

        checkpointContainer.addChild(checkpoint);
        floatingCoins.push({ container: checkpoint, baseY: cy, phaseOffset: index * 0.62 });
      }
      scrollContainer.addChild(checkpointContainer);

      // ── START and END flags ──────────────────────────────────────────────────
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
        const txt = new Text({ text: label, style: new TextStyle({ fontSize: 11, fill: '#ffffff', fontFamily: 'Arial', fontWeight: 'bold' }) });
        txt.anchor.set(0.5); txt.position.set(0, 20);
        flag.addChild(base, marker, pole, cloth, txt);
        scrollContainer.addChild(flag);
      };

      drawFlag(startFlagPixel.x, startFlagPixel.y, 0x22c55e, 'START', 'right');
      drawFlag(endFlagPixel.x,   endFlagPixel.y,   0xef4444, 'END',   'left');

      // ─────────────────────────────────────────────────────────────────────────
      // CHARACTER SETUP — same chibi player + doctor as before
      // ─────────────────────────────────────────────────────────────────────────
      const characterTargetHeight = 72;
      const playerSafeWidth = 90;
      const playerSafeHeight = 140;
      const doctorSafeWidth = 90;

      // Helper: get pixel position for a star index (or startFlagPixel)
      const getCharPixelForIdx = (idx: number): { x: number; y: number } => {
        if (idx < 0) return startFlagPixel;
        if (idx >= starCount) return starPixels[starCount - 1];
        return starPixels[idx];
      };

      const clamp = (v: number, mn: number, mx: number) => Math.max(mn, Math.min(mx, v));

      // Player stands on the step platform top surface, beside the coin.
      const getPlayerPos = (starIdx: number) => {
        const { x, y } = getCharPixelForIdx(starIdx);
        const px = clamp(x - COIN_R - 22, playerSafeWidth / 2 + 4, width - playerSafeWidth / 2 - 4);
        // Feet on platform top = coin.y + COIN_ABOVE - small offset
        const py = y + COIN_ABOVE - tileH * 0.1;
        return { x: px, y: py };
      };

      // ── Draw player ─────────────────────────────────────────────────────────
      const player = new Container();
      let playerSprite: AnimatedSprite | null = null;

      const sw = 2.5;
      const outline = { color: 0x000000, width: sw };
      player.scale.set(2);

      const playerShadow = new Graphics();
      playerShadow.ellipse(0, 0, 12, 6);
      playerShadow.fill({ color: 0x000000, alpha: 0.25 });
      player.addChild(playerShadow);

      const leftLeg = new Graphics();
      leftLeg.roundRect(-7, 10, 6, 11, 3);
      leftLeg.fill(0x2563eb);
      leftLeg.roundRect(-7, 10, 6, 11, 3);
      leftLeg.stroke(outline);
      player.addChild(leftLeg);

      const rightLeg = new Graphics();
      rightLeg.roundRect(1, 10, 6, 11, 3);
      rightLeg.fill(0x2563eb);
      rightLeg.roundRect(1, 10, 6, 11, 3);
      rightLeg.stroke(outline);
      player.addChild(rightLeg);

      const leftFoot = new Graphics();
      leftFoot.roundRect(-8, 20, 7, 3, 1);
      leftFoot.fill(0x1e293b);
      leftFoot.roundRect(-8, 20, 7, 3, 1);
      leftFoot.stroke(outline);
      player.addChild(leftFoot);

      const rightFoot = new Graphics();
      rightFoot.roundRect(1, 20, 7, 3, 1);
      rightFoot.fill(0x1e293b);
      rightFoot.roundRect(1, 20, 7, 3, 1);
      rightFoot.stroke(outline);
      player.addChild(rightFoot);

      const torso = new Graphics();
      torso.roundRect(-10, -6, 20, 18, 8);
      torso.fill(0x3b82f6);
      torso.roundRect(-10, -6, 20, 18, 8);
      torso.stroke(outline);
      player.addChild(torso);

      const leftArm = new Graphics();
      leftArm.roundRect(-13, -2, 6, 14, 3);
      leftArm.fill(0xfec89a);
      leftArm.roundRect(-13, -2, 6, 14, 3);
      leftArm.stroke(outline);
      player.addChild(leftArm);

      const rightArm = new Graphics();
      rightArm.roundRect(7, -2, 6, 14, 3);
      rightArm.fill(0xfec89a);
      rightArm.roundRect(7, -2, 6, 14, 3);
      rightArm.stroke(outline);
      player.addChild(rightArm);

      const head = new Graphics();
      head.circle(0, -22, 13);
      head.fill(0xfec89a);
      head.circle(0, -22, 13);
      head.stroke(outline);
      player.addChild(head);

      const hair = new Graphics();
      hair.ellipse(0, -30, 11, 6);
      hair.fill(0x1e293b);
      hair.ellipse(0, -30, 11, 6);
      hair.stroke(outline);
      player.addChild(hair);

      const backpack = new Graphics();
      backpack.roundRect(-11, -4, 8, 14, 4);
      backpack.fill(0x4f46e5);
      backpack.roundRect(-11, -4, 8, 14, 4);
      backpack.stroke(outline);
      player.addChild(backpack);

      // Try loading Kenney sprite frames
      const playerIdleFrames = (await loadAnimationFrames('player', 'idle')) ?? (await loadKenneyCharacterFrames('player'));
      const playerWalkFrames = await loadAnimationFrames('player', 'walk');
      if (!isRenderActive()) return;

      if ((playerIdleFrames && playerIdleFrames.length > 0) || (playerWalkFrames && playerWalkFrames.length > 0)) {
        player.removeChildren();
        player.scale.set(1);
        const playerShadow2 = new Graphics();
        playerShadow2.ellipse(0, 0, 10, 5);
        playerShadow2.fill({ color: 0x000000, alpha: 0.2 });
        player.addChild(playerShadow2);
        const idleFrames = (playerIdleFrames && playerIdleFrames.length > 0) ? playerIdleFrames : (playerWalkFrames || []);
        playerSprite = new AnimatedSprite(idleFrames);
        playerSprite.anchor.set(0.5, 1);
        playerSprite.scale.set(characterTargetHeight / Math.max(idleFrames[0]?.height || 1, 1));
        playerSprite.animationSpeed = idleFrames.length > 1 ? 0.16 : 0;
        if (idleFrames.length > 1) playerSprite.play();
        player.addChild(playerSprite);
      }

      scrollContainer.addChild(player);

      // ── Draw doctor ─────────────────────────────────────────────────────────
      const doctor = new Container();
      doctor.eventMode = 'static';
      doctor.cursor = 'pointer';
      doctor.on('pointertap', () => (window as any).__openDoctorChat?.());
      let pulseIndicator: Graphics;
      let clickableGlow: Graphics;

      const docSw = 2.5;
      const docOutline = { color: 0x000000, width: docSw };
      doctor.scale.set(2);

      const doctorShadow = new Graphics();
      doctorShadow.ellipse(0, 0, 12, 6);
      doctorShadow.fill({ color: 0x000000, alpha: 0.25 });
      doctor.addChild(doctorShadow);

      const doctorLeftLeg = new Graphics();
      doctorLeftLeg.roundRect(-9, 20, 7, 11, 3);
      doctorLeftLeg.fill(0x1e293b);
      doctorLeftLeg.roundRect(-9, 20, 7, 11, 3);
      doctorLeftLeg.stroke(docOutline);
      doctor.addChild(doctorLeftLeg);

      const doctorRightLeg = new Graphics();
      doctorRightLeg.roundRect(2, 20, 7, 11, 3);
      doctorRightLeg.fill(0x1e293b);
      doctorRightLeg.roundRect(2, 20, 7, 11, 3);
      doctorRightLeg.stroke(docOutline);
      doctor.addChild(doctorRightLeg);

      const doctorBody = new Graphics();
      doctorBody.roundRect(-13, -10, 26, 30, 8);
      doctorBody.fill(0xffffff);
      doctorBody.roundRect(-13, -10, 26, 30, 8);
      doctorBody.stroke(docOutline);
      doctorBody.roundRect(-8, -9, 16, 5, 2);
      doctorBody.fill({ color: 0x99d6ea, alpha: 0.95 });
      doctor.addChild(doctorBody);

      const doctorLeftArm = new Graphics();
      doctorLeftArm.roundRect(-16, -6, 6, 18, 3);
      doctorLeftArm.fill(0xfec89a);
      doctorLeftArm.roundRect(-16, -6, 6, 18, 3);
      doctorLeftArm.stroke(docOutline);
      doctor.addChild(doctorLeftArm);

      const doctorRightArm = new Graphics();
      doctorRightArm.roundRect(10, -6, 6, 18, 3);
      doctorRightArm.fill(0xfec89a);
      doctorRightArm.roundRect(10, -6, 6, 18, 3);
      doctorRightArm.stroke(docOutline);
      doctor.addChild(doctorRightArm);

      const doctorHead = new Graphics();
      doctorHead.circle(0, -26, 14);
      doctorHead.fill(0xfdb68a);
      doctorHead.circle(0, -26, 14);
      doctorHead.stroke(docOutline);
      doctor.addChild(doctorHead);

      const headMirror = new Graphics();
      headMirror.roundRect(-14, -44, 28, 5, 2);
      headMirror.fill(0xcbd5e1);
      headMirror.roundRect(-14, -44, 28, 5, 2);
      headMirror.stroke(docOutline);
      headMirror.circle(0, -46, 6);
      headMirror.fill(0xf1f5f9);
      headMirror.circle(0, -46, 6);
      headMirror.stroke(docOutline);
      doctor.addChild(headMirror);

      const stethoscope = new Graphics();
      stethoscope.roundRect(-2.5, 2, 5, 14, 2);
      stethoscope.stroke({ color: 0x64748b, width: 2.5 });
      stethoscope.circle(0, 17, 4);
      stethoscope.stroke({ color: 0x64748b, width: 2.5 });
      stethoscope.circle(0, 17, 1.5);
      stethoscope.fill(0x94a3b8);
      doctor.addChild(stethoscope);

      clickableGlow = new Graphics();
      clickableGlow.circle(0, 0, 35);
      clickableGlow.fill({ color: 0x3b82f6, alpha: 0.15 });
      doctor.addChildAt(clickableGlow, 0);

      pulseIndicator = new Graphics();
      pulseIndicator.circle(0, 18, 2);
      pulseIndicator.fill({ color: 0xef4444, alpha: 0.8 });
      doctor.addChild(pulseIndicator);

      const chatHint = new Text({
        text: '💬',
        style: new TextStyle({ fontSize: 14, fontFamily: 'Arial' }),
      });
      chatHint.anchor.set(0.5);
      chatHint.position.set(0, -35);
      doctor.addChild(chatHint);

      // Try Kenney doctor frames
      const doctorFrames = (await loadAnimationFrames('doctor', 'idle')) ?? (await loadKenneyCharacterFrames('doctor'));
      if (!isRenderActive()) return;

      if (doctorFrames && doctorFrames.length > 0) {
        doctor.removeChildren();
        doctor.scale.set(1);
        clickableGlow = new Graphics();
        clickableGlow.circle(0, 0, 40);
        clickableGlow.fill({ color: 0x3b82f6, alpha: 0.13 });
        doctor.addChild(clickableGlow);
        const doctorShadow2 = new Graphics();
        doctorShadow2.ellipse(0, 0, 10, 5);
        doctorShadow2.fill({ color: 0x000000, alpha: 0.2 });
        doctor.addChild(doctorShadow2);
        const doctorSprite = new AnimatedSprite(doctorFrames);
        doctorSprite.anchor.set(0.5, 1);
        doctorSprite.scale.set(characterTargetHeight / Math.max(doctorFrames[0].height || 1, 1));
        doctorSprite.animationSpeed = doctorFrames.length > 1 ? 0.16 : 0;
        if (doctorFrames.length > 1) doctorSprite.play();
        doctor.addChild(doctorSprite);
        pulseIndicator = new Graphics();
        pulseIndicator.circle(0, 20, 2.2);
        pulseIndicator.fill({ color: 0xef4444, alpha: 0.8 });
        doctor.addChild(pulseIndicator);
        const doctorHint = new Text({
          text: '💬',
          style: new TextStyle({ fontSize: 14, fontFamily: 'Arial' }),
        });
        doctorHint.anchor.set(0.5);
        doctorHint.position.set(0, -42);
        doctor.addChild(doctorHint);
      }

      const doctorContainer = new Container();
      doctorContainer.addChild(doctor);
      doctorContainer.zIndex = 1000;
      scrollContainer.addChild(doctorContainer);

      // ── Initial character positions ─────────────────────────────────────────
      const progressIdx = Math.max(-1, Math.min(completed - 1, starCount - 1));
      const mapKey = `hex:${starCount}:${total}`;
      if (lastMapKeyRef.current !== mapKey) {
        lastMapKeyRef.current = mapKey;
        lastCompletedRef.current = progressIdx;
      }
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
      doctorContainer.position.set(x + COIN_R * 2 + 24, y - 8);

      // ── Animation ticker ────────────────────────────────────────────────────
      let tick = 0;
      app.ticker.add(() => {
        if (!isRenderActive()) return;
        tick += 0.03;

        const liveProgressIdx = Math.max(-1, Math.min(completed - 1, starCount - 1));
        const livePos = getPlayerPos(liveProgressIdx);
        targetX = livePos.x;
        targetY = livePos.y;

        if (isWalkingToNext) {
          const t = Math.min(1, (performance.now() - walkStart) / walkDurationMs);
          x = startPos.x + (targetX - startPos.x) * t;
          y = startPos.y + (targetY - startPos.y) * t;
          if (t >= 1) {
            isWalkingToNext = false;
            isPlayerWalkingAnim = false;
          }
        } else {
          x += (targetX - x) * 0.12;
          y += (targetY - y) * 0.12;
        }

        const bob = isWalkingToNext ? Math.sin(tick * 7) * 1.1 : 0;
        const breathe = Math.sin(tick * 2.1);
        const walk = Math.sin(tick * 4.5);

        player.position.set(x, y + bob);
        player.rotation = isWalkingToNext ? Math.sin(tick * 1.2) * 0.02 : 0;

        // Switch sprite animation state
        if (playerSprite && playerWalkFrames && playerWalkFrames.length > 1 && playerIdleFrames && playerIdleFrames.length > 0) {
          if (isPlayerWalkingAnim) {
            if (playerSprite.textures !== playerWalkFrames) {
              playerSprite.textures = playerWalkFrames;
              playerSprite.animationSpeed = 0.22;
              playerSprite.play();
            }
          } else if (playerSprite.textures !== playerIdleFrames) {
            playerSprite.textures = playerIdleFrames;
            playerSprite.animationSpeed = playerIdleFrames.length > 1 ? 0.16 : 0;
            if (playerIdleFrames.length > 1) playerSprite.play();
            else playerSprite.gotoAndStop(0);
          }
        }

        // Leg/arm animation for fallback drawn character
        if (player.children.length > 2) {
          leftLeg.rotation = walk * 0.15;
          rightLeg.rotation = -walk * 0.15;
          leftArm.rotation = -walk * 0.2;
          rightArm.rotation = walk * 0.2;
          torso.scale.y = 1 + breathe * 0.03;
          head.y = -18 + breathe * 0.6;
          hair.y = -24 + breathe * 0.5;
        }

        // Doctor follows player, offset to the right
        doctorContainer.position.x = x + COIN_R * 2 + 24;
        doctorContainer.position.y = y + bob * 0.7;

        // Animate floating coins (gentle up-down bob)
        for (const fc of floatingCoins) {
          const floatY = Math.sin(tick * 1.8 + fc.phaseOffset) * 3.5;
          fc.container.y = fc.baseY + floatY;
          // Also scale shadow inversely (shrinks when coin is higher)
          const shadowScale = 1 - Math.abs(floatY) * 0.04;
          const sh = (fc.container as any)._shadow as Graphics | undefined;
          if (sh) sh.scale.set(shadowScale, shadowScale);
        }

        // Animate checkpoint glows
        checkpointContainer.children.forEach((child: any) => {
          if (child._isCurrent && child._isCurrentGlow) {
            const pulse = Math.sin(tick * 4) * 0.5 + 0.5;
            child._isCurrentGlow.scale.set(1 + pulse * 0.18);
            child._isCurrentGlow.alpha = 0.55 + pulse * 0.45;
          }
        });

        // Pulse doctor indicator
        const pulse = Math.sin(tick * 6) * 0.5 + 0.5;
        pulseIndicator.scale.set(1 + pulse * 0.3);
        pulseIndicator.alpha = 0.6 + pulse * 0.4;
        clickableGlow.alpha = 0.08 + Math.sin(tick * 3) * 0.05;
      });
    },
    [onCheckpointClick, checklistItems, eventsPerStar, loadAnimationFrames, loadKenneyCharacterFrames]
  );

  useEffect(() => {
    if (!containerRef.current) return;

    const initApp = async () => {
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }

      const app = new Application();
      let lastWidth = 0;
      let lastHeight = 0;

      const updateSize = () => {
        if (!containerRef.current || !appRef.current) return;
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        const sizeChanged = Math.abs(w - lastWidth) > 10 || Math.abs(h - lastHeight) > 10;
        if (sizeChanged || lastWidth === 0 || lastHeight === 0) {
          lastWidth = w;
          lastHeight = h;
          appRef.current.renderer.resize(w, h);
          const themeData = getTheme(theme);
          drawMap(appRef.current, themeData, completedCount, totalCount, mapSpec).catch(console.error);
        } else {
          appRef.current.renderer.resize(w, h);
        }
      };

      await app.init({
        width: containerRef.current!.clientWidth,
        height: containerRef.current!.clientHeight,
        backgroundAlpha: 0,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      containerRef.current!.innerHTML = '';
      containerRef.current!.appendChild(app.canvas as HTMLCanvasElement);
      appRef.current = app;
      lastWidth = containerRef.current!.clientWidth;
      lastHeight = containerRef.current!.clientHeight;

      const themeData = getTheme(theme);
      drawMap(app, themeData, completedCount, totalCount, mapSpec).catch(console.error);

      // Touch / scroll handlers
      let touchStartY = 0;
      let isDragging = false;

      const handleTouchStart = (e: TouchEvent) => {
        if (scrollContainerRef.current) {
          touchStartY = e.touches[0].clientY;
          isDragging = true;
        }
      };

      const handleTouchMove = (e: TouchEvent) => {
        if (!isDragging || !scrollContainerRef.current) return;
        e.preventDefault();
        const deltaY = touchStartY - e.touches[0].clientY;
        touchStartY = e.touches[0].clientY;
        scrollYRef.current = Math.max(0, Math.min(maxScrollYRef.current, scrollYRef.current + deltaY));
        scrollContainerRef.current.y = -scrollYRef.current;
      };

      const handleTouchEnd = () => { isDragging = false; };

      const handleWheel = (e: WheelEvent) => {
        if (scrollContainerRef.current) {
          e.preventDefault();
          scrollYRef.current = Math.max(0, Math.min(maxScrollYRef.current, scrollYRef.current + e.deltaY));
          scrollContainerRef.current.y = -scrollYRef.current;
        }
      };

      const canvas = app.canvas as HTMLCanvasElement;
      canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
      canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
      canvas.addEventListener('touchend', handleTouchEnd);
      canvas.addEventListener('wheel', handleWheel, { passive: false });
      (app as any).__touchHandlers = { handleTouchStart, handleTouchMove, handleTouchEnd, handleWheel };

      const resizeObserver = new ResizeObserver(() => updateSize());
      if (containerRef.current) resizeObserver.observe(containerRef.current);

      const handleWindowResize = () => {
        clearTimeout((window as any).__gameCanvasResizeTimeout);
        (window as any).__gameCanvasResizeTimeout = setTimeout(() => updateSize(), 100);
      };
      window.addEventListener('resize', handleWindowResize);
      window.addEventListener('orientationchange', handleWindowResize);

      (app as any).__resizeObserver = resizeObserver;
      (app as any).__resizeHandler = handleWindowResize;
    };

    initApp();

    return () => {
      if (appRef.current) {
        if ((appRef.current as any).__resizeObserver) {
          (appRef.current as any).__resizeObserver.disconnect();
        }
        if ((appRef.current as any).__resizeHandler) {
          window.removeEventListener('resize', (appRef.current as any).__resizeHandler);
          window.removeEventListener('orientationchange', (appRef.current as any).__resizeHandler);
        }
        if ((appRef.current as any).__touchHandlers) {
          const canvas = appRef.current.canvas as HTMLCanvasElement;
          const handlers = (appRef.current as any).__touchHandlers;
          canvas.removeEventListener('touchstart', handlers.handleTouchStart);
          canvas.removeEventListener('touchmove', handlers.handleTouchMove);
          canvas.removeEventListener('touchend', handlers.handleTouchEnd);
          canvas.removeEventListener('wheel', handlers.handleWheel);
        }
        appRef.current.destroy(true);
        appRef.current = null;
      }
    };
  }, [theme, completedCount, totalCount, mapSpec, drawMap]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden"
    />
  );
}

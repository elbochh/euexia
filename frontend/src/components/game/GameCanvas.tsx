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
  mapImageUrl?: string | null;
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
  mapImageUrl,
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

  const hexToNumber = (hex: string, fallback: number): number => {
    if (!hex || !hex.startsWith('#')) return fallback;
    const parsed = Number.parseInt(hex.slice(1), 16);
    return Number.isNaN(parsed) ? fallback : parsed;
  };

  const drawDecorAsset = (
    g: Graphics,
    assetId: string,
    cx: number,
    cy: number,
    baseSize: number,
    color: number
  ) => {
    const id = assetId.toLowerCase();

    if (id.includes('pyramid')) {
      g.moveTo(cx, cy + baseSize);
      g.lineTo(cx + baseSize, cy + baseSize);
      g.lineTo(cx + baseSize / 2, cy);
      g.closePath();
      g.fill(color);
      g.moveTo(cx + baseSize / 2, cy);
      g.lineTo(cx + baseSize, cy + baseSize);
      g.lineTo(cx + baseSize / 2, cy + baseSize);
      g.closePath();
      g.fill({ color: 0xffffff, alpha: 0.15 });
      return;
    }

    if (id.includes('tree') || id.includes('palm')) {
      g.roundRect(cx - baseSize * 0.06, cy, baseSize * 0.12, baseSize * 0.9, 4);
      g.fill(0x7c4a1d);
      g.ellipse(cx, cy - baseSize * 0.05, baseSize * 0.48, baseSize * 0.26);
      g.fill(color);
      if (id.includes('palm')) {
        g.ellipse(cx - baseSize * 0.2, cy - baseSize * 0.1, baseSize * 0.3, baseSize * 0.12);
        g.fill({ color, alpha: 0.85 });
        g.ellipse(cx + baseSize * 0.2, cy - baseSize * 0.1, baseSize * 0.3, baseSize * 0.12);
        g.fill({ color, alpha: 0.85 });
      }
      return;
    }

    if (id.includes('cactus') || id.includes('vine')) {
      g.roundRect(cx - baseSize * 0.1, cy - baseSize * 0.7, baseSize * 0.2, baseSize * 0.7, 6);
      g.fill(color);
      g.roundRect(cx - baseSize * 0.3, cy - baseSize * 0.52, baseSize * 0.16, baseSize * 0.28, 6);
      g.fill(color);
      g.roundRect(cx + baseSize * 0.14, cy - baseSize * 0.48, baseSize * 0.16, baseSize * 0.24, 6);
      g.fill(color);
      return;
    }

    if (id.includes('waterfall')) {
      g.roundRect(cx - baseSize * 0.18, cy - baseSize * 0.5, baseSize * 0.36, baseSize, 8);
      g.fill({ color: 0x60a5fa, alpha: 0.55 });
      g.roundRect(cx - baseSize * 0.06, cy - baseSize * 0.45, baseSize * 0.12, baseSize * 0.9, 4);
      g.fill({ color: 0xdbf4ff, alpha: 0.6 });
      return;
    }

    if (id.includes('tower') || id.includes('skyline') || id.includes('building')) {
      g.roundRect(cx - baseSize * 0.14, cy - baseSize, baseSize * 0.28, baseSize, 4);
      g.fill(color);
      for (let row = 0; row < 6; row += 1) {
        for (let col = 0; col < 2; col += 1) {
          g.rect(
            cx - baseSize * 0.09 + col * baseSize * 0.1,
            cy - baseSize * 0.85 + row * baseSize * 0.13,
            baseSize * 0.05,
            baseSize * 0.05
          );
          g.fill({ color: 0xfde68a, alpha: row % 2 === 0 ? 0.7 : 0.25 });
        }
      }
      return;
    }

    if (id.includes('pill') || id.includes('vitamin')) {
      g.roundRect(cx - baseSize * 0.35, cy - baseSize * 0.15, baseSize * 0.7, baseSize * 0.3, 20);
      g.fill(color);
      g.roundRect(cx - baseSize * 0.35, cy - baseSize * 0.15, baseSize * 0.35, baseSize * 0.3, 20);
      g.fill({ color: 0xffffff, alpha: 0.4 });
      return;
    }

    // Default rock/patch blob
    g.ellipse(cx, cy, baseSize * 0.42, baseSize * 0.24);
    g.fill(color);
  };

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
      dynamicSpec?: PersonalizedMapSpec | null,
      imageUrl?: string | null
    ) => {
      const renderSeq = ++renderSeqRef.current;
      const isRenderActive = () => appRef.current === app && renderSeqRef.current === renderSeq && !!app.stage;
      if (!isRenderActive()) return;

      const { width, height } = app.screen;

      // Clear existing children
      while (app.stage.children.length > 0) {
        app.stage.removeChildAt(0);
      }
      // Reset scroll state each render to avoid stale refs after mode switches.
      scrollContainerRef.current = null;
      scrollYRef.current = 0;
      maxScrollYRef.current = 0;

      const accentColor = dynamicSpec?.palette?.accent
        ? hexToNumber(dynamicSpec.palette.accent, themeData.checkpointGlow)
        : themeData.checkpointGlow;
      const primaryColor = dynamicSpec?.palette?.primary
        ? hexToNumber(dynamicSpec.palette.primary, themeData.checkpointColor)
        : themeData.checkpointColor;
      const secondaryColor = dynamicSpec?.palette?.secondary
        ? hexToNumber(dynamicSpec.palette.secondary, themeData.pathColor)
        : themeData.pathColor;

      let hasImageBackground = false;
      let parallaxContainer: Container | null = null;
      
      // If we have a map image, use it as background
      if (imageUrl) {
        try {
          const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
          const fullImageUrl = imageUrl.startsWith('http') ? imageUrl : `${API_URL.replace('/api', '')}${imageUrl}`;
          
          // Load texture using Assets API (Pixi.js v8)
          const texture = await Assets.load(fullImageUrl);
          if (!isRenderActive()) return;
          
          // Scroll height based on star count (visual nodes on the map), NOT raw event count.
          // total = number of distinct stars; target ~6 stars per viewport screen.
          const starCount = Math.max(total, 2);
          const scrollableMapHeights = Math.max(3, Math.ceil(starCount / 6));
          const mapHeight = height * scrollableMapHeights; // total scrollable height = 3 viewport heights
          const scale = mapHeight / texture.height;
          const mapWidth = texture.width * scale;

          const scrollContainer = new Container();
          scrollContainerRef.current = scrollContainer;

          const mapSprite = new Sprite(texture);
          mapSprite.scale.set(scale);
          mapSprite.x = (width - mapWidth) / 2; // center horizontally so path (middle) is in view
          mapSprite.y = 0;

          scrollContainer.addChild(mapSprite);

          maxScrollYRef.current = Math.max(0, mapHeight - height);
          // Start at the very bottom so user sees the start flag/task-1 area first.
          scrollYRef.current = maxScrollYRef.current;
          scrollContainer.y = -scrollYRef.current;

          const mask = new Graphics();
          mask.rect(0, 0, width, height);
          mask.fill(0xffffff);
          app.stage.addChild(mask);
          scrollContainer.mask = mask;

          app.stage.addChild(scrollContainer);
          hasImageBackground = true;
        } catch (error) {
          console.error('Failed to load map image:', error);
          // Fall through to draw default background
        }
      }

      // If no image or image failed, draw default background
      if (!hasImageBackground) {
        const skyColor = dynamicSpec?.palette?.sky
          ? hexToNumber(dynamicSpec.palette.sky, themeData.skyColors[0])
          : themeData.skyColors[0];
        const groundColor = dynamicSpec?.palette?.ground
          ? hexToNumber(dynamicSpec.palette.ground, themeData.groundColor)
          : themeData.groundColor;

        // --- Layer 1: Sky with vertical pseudo-gradient ---
        const skyLayer = new Container();
        const steps = 18;
        for (let i = 0; i < steps; i += 1) {
          const band = new Graphics();
          const alpha = 0.2 + (i / steps) * 0.5;
          band.rect(0, (height * 0.45 * i) / steps, width, height * 0.45 / steps + 2);
          band.fill({ color: skyColor, alpha });
          skyLayer.addChild(band);
        }
        app.stage.addChild(skyLayer);

        // Sun / moon glow
        const orb = new Graphics();
        orb.circle(width * 0.85, height * 0.14, 26);
        orb.fill({ color: accentColor, alpha: 0.9 });
        orb.circle(width * 0.85, height * 0.14, 48);
        orb.fill({ color: accentColor, alpha: 0.22 });
        orb.circle(width * 0.85, height * 0.14, 70);
        orb.fill({ color: accentColor, alpha: 0.1 });
        app.stage.addChild(orb);

        // --- Layer 2: Ground bands ---
        const farGround = new Graphics();
        farGround.rect(0, height * 0.45, width, height * 0.55);
        farGround.fill({ color: groundColor, alpha: 0.9 });
        app.stage.addChild(farGround);

        const nearGround = new Graphics();
        nearGround.rect(0, height * 0.58, width, height * 0.42);
        nearGround.fill({ color: 0x000000, alpha: 0.08 });
        app.stage.addChild(nearGround);

        // --- Layer 3: Parallax silhouettes (from spec) ---
        const parallax = new Container();
        parallaxContainer = parallax;
        const layers = dynamicSpec?.background?.parallaxLayers || [];
        layers.forEach((layer, idx) => {
          const silhouette = new Graphics();
          const baseline = height * (0.35 + idx * 0.08);
          const amp = 24 + idx * 10;
          silhouette.moveTo(0, baseline);
          for (let x = 0; x <= width; x += 24) {
            const y = baseline + Math.sin((x / width) * Math.PI * 2 + idx) * amp;
            silhouette.lineTo(x, y);
          }
          silhouette.lineTo(width, height);
          silhouette.lineTo(0, height);
          silhouette.closePath();
          silhouette.fill({ color: 0x000000, alpha: layer.opacity * 0.25 });
          (silhouette as any)._parallaxSpeed = layer.speed;
          parallax.addChild(silhouette);
        });
        app.stage.addChild(parallax);
      }

      // --- Layer 4: Decor assets (only if no image background) ---
      // Skip decor when we have an AI-generated map image to avoid visual conflicts
      const decorFront = new Container();
      if (!hasImageBackground) {
        const decorBack = new Container();
        const decorMid = new Container();
        const decorItems =
          dynamicSpec?.decor && dynamicSpec.decor.length > 0
            ? dynamicSpec.decor
            : themeData.elements.map((e: any) => ({
                assetId: e.type,
                x: e.x,
                y: e.y,
                scale: Math.max(0.7, Math.min(1.6, (e.size || 26) / 60)),
                layer: e.y < 0.4 ? 'back' : e.y < 0.7 ? 'mid' : 'front',
              }));

        decorItems.forEach((item) => {
          const g = new Graphics();
          const size = 48 * (item.scale || 1);
          const x = item.x * width;
          const y = item.y * height;
          drawDecorAsset(g, item.assetId, x, y, size, secondaryColor);
          if (item.layer === 'back') decorBack.addChild(g);
          else if (item.layer === 'front') decorFront.addChild(g);
          else decorMid.addChild(g);
        });
        app.stage.addChild(decorBack);
        app.stage.addChild(decorMid);
      }

      // Draw path - Clash of Clans style with dotted path
      const pathContainer = new Container();
      const pathPoints = (
        dynamicSpec?.path?.length ? dynamicSpec.path : themeData.pathPoints
      ).slice(0, Math.max(total, 2));
      const nodePoints = (
        dynamicSpec?.nodes?.length
          ? dynamicSpec.nodes
              .slice()
              .sort((a, b) => a.index - b.index)
              .map((node) => ({ x: node.x, y: node.y }))
          : pathPoints
      ).slice(0, Math.max(total, 2));
      const pathGraphics = new Graphics();
      const progressGraphics = new Graphics();

      // Draw dotted path connecting checkpoints (Clash of Clans style - enhanced)
      for (let i = 0; i < nodePoints.length - 1; i++) {
        // Convert normalized coordinates to pixel coordinates
        let p1x: number, p1y: number, p2x: number, p2y: number;
        
        if (scrollContainerRef.current) {
          const mapImage = scrollContainerRef.current.children.find((child: any) => child instanceof Sprite) as Sprite | undefined;
          if (mapImage) {
            const mapWidth = mapImage.width;
            const mapHeight = mapImage.height;
            // y=1.0 is bottom of map, y=0.0 is top of map
            p1x = nodePoints[i].x * mapWidth;
            p1y = nodePoints[i].y * mapHeight; // y=1.0 → bottom, y=0.0 → top
            p2x = nodePoints[i + 1].x * mapWidth;
            p2y = nodePoints[i + 1].y * mapHeight;
          } else {
            p1x = nodePoints[i].x * width;
            p1y = nodePoints[i].y * height;
            p2x = nodePoints[i + 1].x * width;
            p2y = nodePoints[i + 1].y * height;
          }
        } else {
          p1x = nodePoints[i].x * width;
          p1y = nodePoints[i].y * height;
          p2x = nodePoints[i + 1].x * width;
          p2y = nodePoints[i + 1].y * height;
        }
        
        const p1 = { x: p1x, y: p1y };
        const p2 = { x: p2x, y: p2y };
        
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const dotSpacing = 14;
        const numDots = Math.floor(distance / dotSpacing);
        
        for (let j = 0; j <= numDots; j++) {
          const t = j / numDots;
          const x = p1.x + dx * t;
          const y = p1.y + dy * t;
          
          // Draw path dots with multiple layers for depth
          // Outer shadow
          pathGraphics.circle(x, y + 1, 4.5);
          pathGraphics.fill({ color: 0x000000, alpha: 0.3 });
          
          // Main dot with gradient effect
          pathGraphics.circle(x, y, 4);
          pathGraphics.fill({ color: 0xffffff, alpha: 0.85 });
          
          // Inner highlight
          pathGraphics.circle(x, y - 1, 2.5);
          pathGraphics.fill({ color: 0xffffff, alpha: 0.5 });
          
          // Top highlight for 3D effect
          pathGraphics.circle(x, y - 1.5, 1.5);
          pathGraphics.fill({ color: 0xffffff, alpha: 0.7 });
        }
        
        // Completed segment - golden/orange dots with enhanced styling
        if (i < completed) {
          for (let j = 0; j <= numDots; j++) {
            const t = j / numDots;
            const x = p1.x + dx * t;
            const y = p1.y + dy * t;
            
            // Subtle shadow
            progressGraphics.circle(x, y + 0.5, 4);
            progressGraphics.fill({ color: 0x000000, alpha: 0.2 });
            
            // Main green dot (completed path)
            progressGraphics.circle(x, y, 4);
            progressGraphics.fill({ color: 0x4ade80, alpha: 1.0 });
            
            // Light highlight
            progressGraphics.circle(x, y - 1, 2.5);
            progressGraphics.fill({ color: 0x86efac, alpha: 0.7 });
          }
        }
      }
      pathContainer.addChild(pathGraphics);
      pathContainer.addChild(progressGraphics);

      // Draw checkpoints using star icon image
      let starIconTexture: any = null;
      let chainTexture: any = null;
      try {
        // Load star icon image
        starIconTexture = await Assets.load('/star_icon.png');
        if (!isRenderActive()) return;
      } catch (error) {
        console.warn('Failed to load star_icon.png, using fallback rendering:', error);
      }
      try {
        chainTexture = await Assets.load('/chains.png');
        if (!isRenderActive()) return;
      } catch {
        chainTexture = null;
      }

      const starRadius = 40;
      const marginPx = 14;
      const maxNodeIndex = Math.max(0, nodePoints.length - 1);
      const n0 = nodePoints[0] ?? { x: 0.5, y: 0.9 };
      const n1 = nodePoints[1] ?? { x: n0.x, y: Math.max(0, n0.y - 0.1) };
      const nl = nodePoints[maxNodeIndex] ?? { x: 0.5, y: 0.1 };
      const nlm1 = nodePoints[Math.max(0, maxNodeIndex - 1)] ?? { x: nl.x, y: Math.min(1, nl.y + 0.1) };
      const startDx = n0.x - n1.x;
      const startDy = n0.y - n1.y;
      const endDx = nl.x - nlm1.x;
      const endDy = nl.y - nlm1.y;
      const startNorm = Math.max(0.0001, Math.hypot(startDx, startDy));
      const endNorm = Math.max(0.0001, Math.hypot(endDx, endDy));
      const startFlagPoint = {
        x: Math.max(0.06, Math.min(0.94, n0.x + (startDx / startNorm) * 0.12)),
        y: Math.max(0.02, Math.min(0.98, n0.y + (startDy / startNorm) * 0.12)),
      };
      const endFlagPoint = {
        x: Math.max(0.06, Math.min(0.94, nl.x + (endDx / endNorm) * 0.12)),
        y: Math.max(0.02, Math.min(0.98, nl.y + (endDy / endNorm) * 0.12)),
      };

      const getPointPixel = (point: { x: number; y: number }) => {
        let cx: number, cy: number;
        let mapWidthForClamp: number, mapHeightForClamp: number;
        if (scrollContainerRef.current) {
          const mapImage = scrollContainerRef.current.children.find((child: any) => child instanceof Sprite) as Sprite | undefined;
          if (mapImage) {
            mapWidthForClamp = mapImage.width;
            mapHeightForClamp = mapImage.height;
            cx = point.x * mapWidthForClamp;
            cy = point.y * mapHeightForClamp;
          } else {
            mapWidthForClamp = width;
            mapHeightForClamp = height;
            cx = point.x * width;
            cy = point.y * height;
          }
        } else {
          mapWidthForClamp = width;
          mapHeightForClamp = height;
          cx = point.x * width;
          cy = point.y * height;
        }
        cx = Math.max(starRadius + marginPx, Math.min(mapWidthForClamp - starRadius - marginPx, cx));
        cy = Math.max(starRadius + marginPx, Math.min(mapHeightForClamp - starRadius - marginPx, cy));
        return { x: cx, y: cy };
      };

      nodePoints.forEach((point, index) => {
        const p = getPointPixel(point);
        const cx = p.x;
        const cy = p.y;

        const eventsAtStar = eventsPerStar?.[index] ?? (checklistItems[index] ? [checklistItems[index]] : []);
        const isStarCompleted = eventsAtStar.some((e: ChecklistItem) => e.isCompleted);
        const hasAvailable = eventsAtStar.some((e: ChecklistItem) => !e.isCompleted && !e.isLocked);
        const isStarLocked = eventsAtStar.length > 0 && !isStarCompleted && !hasAvailable;
        const isCompleted = isStarCompleted;
        const isCurrent = index === completed;
        const isLocked = isStarLocked || (eventsAtStar.length === 0 && index > completed);

        const checkpoint = new Container();
        checkpoint.position.set(cx, cy);
        checkpoint.eventMode = 'static';
        checkpoint.cursor = 'pointer';
        checkpoint.on('pointertap', () => onCheckpointClick?.(index));

        // Low elevated shadow under the icon (subtle but visible)
        const shadowGraphics = new Graphics();
        shadowGraphics.circle(0, 2, 22);
        shadowGraphics.fill({ color: 0x000000, alpha: 0.18 });
        checkpoint.addChild(shadowGraphics);

        // Outer glow ring for current/active checkpoint (separate container for animation)
        let currentGlowContainer: Container | null = null;
        if (isCurrent && !isLocked) {
          currentGlowContainer = new Container();
          const glowGraphics = new Graphics();
          const goldenOrangeGlow = 0xFF8C42; // Match the golden-orange coin color
          // Multiple glow layers with golden-orange (scaled up for bigger icon)
          glowGraphics.circle(0, 0, 57);
          glowGraphics.fill({ color: goldenOrangeGlow, alpha: 0.15 });
          glowGraphics.circle(0, 0, 51);
          glowGraphics.fill({ color: goldenOrangeGlow, alpha: 0.25 });
          glowGraphics.circle(0, 0, 45);
          glowGraphics.fill({ color: goldenOrangeGlow, alpha: 0.35 });
          currentGlowContainer.addChild(glowGraphics);
          checkpoint.addChildAt(currentGlowContainer, 0); // Add behind main graphics
          (currentGlowContainer as any)._isCurrentGlow = true;
        }

        // Icon size constant for positioning
        const iconSize = 36; // Approximate size of the icon after scaling (increased from 24)
        
        // Use star icon sprite if available
        if (starIconTexture) {
          const starSprite = new Sprite(starIconTexture);
          starSprite.anchor.set(0.5);
          // Scale to approximately 72px diameter (increased from 48px)
          const targetSize = 72;
          const textureSize = Math.max(starIconTexture.width, starIconTexture.height);
          starSprite.scale.set(targetSize / textureSize);
          
          // Apply grey overlay for uncompleted tasks
          if (!isCompleted && isLocked) {
            // Strong grey overlay for locked/uncompleted tasks
            const greyFilter = new ColorMatrixFilter();
            greyFilter.greyscale(0.3, true); // Convert to greyscale with reduced brightness
            greyFilter.brightness(0.4, false); // Make it darker
            greyFilter.saturate(-0.8, false); // Desaturate
            starSprite.filters = [greyFilter];
          } else if (isCompleted) {
            // No overlay for completed tasks - keep original colors
            starSprite.filters = [];
          } else {
            // Current/active checkpoint - no overlay, keep original golden-orange
            starSprite.filters = [];
          }
          
          checkpoint.addChild(starSprite);
        } else {
          // Fallback: draw circle if image not available
          const checkpointGraphics = new Graphics();
          checkpointGraphics.circle(0, 0, iconSize);
          checkpointGraphics.fill({ color: isCompleted ? 0x4ade80 : isLocked ? 0x6b7280 : 0xFF8C42, alpha: 1.0 });
          checkpointGraphics.circle(0, 0, iconSize);
          checkpointGraphics.stroke({ color: 0xffffff, width: 2.5, alpha: 1.0 });
          checkpoint.addChild(checkpointGraphics);
        }

        // Locked checkpoint visual: chain marker on top of star
        if (isLocked && !isCompleted) {
          if (chainTexture) {
            const chain = new Sprite(chainTexture);
            chain.anchor.set(0.5);
            const maxChainSize = 26;
            const chainTexSize = Math.max(chainTexture.width, chainTexture.height, 1);
            chain.scale.set(maxChainSize / chainTexSize);
            chain.position.set(0, 0);
            checkpoint.addChild(chain);
          } else {
            const lockText = new Text({
              text: '⛓',
              style: new TextStyle({
                fontSize: 18,
                fill: '#f8fafc',
                fontFamily: 'Arial',
                fontWeight: 'bold',
                dropShadow: true,
              }),
            });
            lockText.anchor.set(0.5);
            lockText.position.set(0, 0);
            checkpoint.addChild(lockText);
          }
        }

        // Checkpoint title: only show when at least one event at this star is completed
        const completedEvent = eventsAtStar.find((e: ChecklistItem) => e.isCompleted);
        const titleToShow = completedEvent?.title ?? null;
        if (titleToShow) {
          const titleStyle = new TextStyle({
            fontSize: 11,
            fill: isCompleted ? '#86efac' : isCurrent ? '#ffffff' : '#9ca3af',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            dropShadow: true,
          });
          (titleStyle as any).dropShadowColor = 0x000000;
          (titleStyle as any).dropShadowBlur = 2;
          (titleStyle as any).dropShadowDistance = 1;
          let titleText = titleToShow;
          if (titleText.length > 20) titleText = titleText.substring(0, 17) + '...';
          const title = new Text({ text: titleText, style: titleStyle });
          title.anchor.set(0.5);
          title.position.set(0, iconSize + 16);
          checkpoint.addChild(title);
        }

        pathContainer.addChild(checkpoint);
        
        // Store reference to current checkpoint for animation
        if (isCurrent && !isLocked && currentGlowContainer) {
          (checkpoint as any)._isCurrent = true;
          (checkpoint as any)._glowContainer = currentGlowContainer;
        }
      });

      // Start/end flag markers (visual journey anchors)
      const drawFlag = (pt: { x: number; y: number }, color: number, label: string, side: 'left' | 'right') => {
        const pos = getPointPixel(pt);
        const flag = new Container();
        flag.position.set(pos.x, pos.y);
        const marker = new Graphics();
        marker.circle(0, 0, 5.5);
        marker.fill({ color: 0xffffff, alpha: 0.95 });
        marker.circle(0, 0, 4.1);
        marker.fill({ color, alpha: 1 });
        marker.stroke({ color: 0x111827, width: 1.1, alpha: 0.8 });
        const pole = new Graphics();
        const poleX = side === 'left' ? -14 : 14;
        pole.roundRect(poleX - 2, -24, 4, 26, 2);
        pole.fill(0x374151);
        const cloth = new Graphics();
        const clothStartX = side === 'left' ? poleX - 2 : poleX + 2;
        const clothEndX = side === 'left' ? poleX - 18 : poleX + 18;
        cloth.moveTo(clothStartX, -22);
        cloth.lineTo(clothEndX, -16);
        cloth.lineTo(clothStartX, -10);
        cloth.closePath();
        cloth.fill(color);
        cloth.stroke({ color: 0xffffff, width: 1, alpha: 0.9 });
        const base = new Graphics();
        base.ellipse(0, 3, 11, 4);
        base.fill({ color: 0x000000, alpha: 0.18 });
        flag.addChild(base, marker, pole, cloth);
        const text = new Text({
          text: label,
          style: new TextStyle({
            fontSize: 9,
            fill: '#ffffff',
            fontFamily: 'Arial',
            fontWeight: 'bold',
          }),
        });
        text.anchor.set(0.5);
        text.position.set(0, 12);
        flag.addChild(text);
        pathContainer.addChild(flag);
      };
      drawFlag(startFlagPoint, 0x22c55e, 'START', 'left');
      drawFlag(endFlagPoint, 0xef4444, 'END', 'right');

      // Add path and checkpoints to scroll container if scrollable, otherwise to stage
      if (scrollContainerRef.current) {
        const mapSprite = scrollContainerRef.current.getChildAt(0) as Sprite;
        if (mapSprite) {
          pathContainer.x = mapSprite.x;
          pathContainer.y = 0;
          decorFront.x = mapSprite.x;
          decorFront.y = 0;
        }
        scrollContainerRef.current.addChild(pathContainer);
        scrollContainerRef.current.addChild(decorFront);
      } else {
        app.stage.addChild(pathContainer);
        app.stage.addChild(decorFront);
      }

      // Player character - detailed animated character
      const player = new Container();
      const characterTargetHeight = 84;
      // Scale up for Clash-of-Clans style presence (2x)
      const playerScale = 2;
      player.scale.set(playerScale);
      let playerSprite: AnimatedSprite | null = null;
      // Use conservative viewport bounds independent of texture frame quirks.
      const playerSafeWidth = 108;
      const playerSafeHeight = 172;

      const sw = 2.5; // Thick black outline - Clash of Clans style
      const outline = { color: 0x000000, width: sw };

      // Shadow
      const playerShadow = new Graphics();
      playerShadow.ellipse(0, 0, 12, 6);
      playerShadow.fill({ color: 0x000000, alpha: 0.25 });
      playerShadow.position.set(0, 0);
      player.addChild(playerShadow);

      // Legs (chibi) - redraw path before stroke so outline renders (Pixi v8)
      const leftLeg = new Graphics();
      leftLeg.roundRect(-7, 10, 6, 11, 3);
      leftLeg.fill(0x2563eb);
      leftLeg.roundRect(-7, 10, 6, 11, 3);
      leftLeg.stroke(outline);
      leftLeg.roundRect(-6, 11, 4, 3, 1.5);
      leftLeg.fill({ color: 0x1e40af, alpha: 0.7 });
      player.addChild(leftLeg);

      const rightLeg = new Graphics();
      rightLeg.roundRect(1, 10, 6, 11, 3);
      rightLeg.fill(0x2563eb);
      rightLeg.roundRect(1, 10, 6, 11, 3);
      rightLeg.stroke(outline);
      rightLeg.roundRect(2, 11, 4, 3, 1.5);
      rightLeg.fill({ color: 0x1e40af, alpha: 0.7 });
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

      // Torso - blue shirt
      const torso = new Graphics();
      torso.roundRect(-10, -6, 20, 18, 8);
      torso.fill(0x3b82f6);
      torso.roundRect(-10, -6, 20, 18, 8);
      torso.stroke(outline);
      torso.roundRect(-8, -4, 16, 6, 3);
      torso.fill({ color: 0x2563eb, alpha: 0.85 });
      torso.roundRect(-9, 8, 18, 3, 1);
      torso.fill(0x1e293b);
      torso.roundRect(-9, 8, 18, 3, 1);
      torso.stroke(outline);
      player.addChild(torso);

      // Arms
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

      // Head - chibi with subtle highlight (2D-that-looks-3D)
      const head = new Graphics();
      head.circle(0, -22, 13);
      head.fill(0xfec89a);
      head.circle(0, -22, 13);
      head.stroke(outline);
      head.circle(0, -20, 10);
      head.fill({ color: 0xfdb68a, alpha: 0.4 });
      // Top-left highlight for volume
      head.ellipse(-4, -30, 4, 3);
      head.fill({ color: 0xffffff, alpha: 0.35 });
      player.addChild(head);

      // Eyes (bold, CoC style)
      const leftEye = new Graphics();
      leftEye.circle(-4, -24, 2.2);
      leftEye.fill(0x1f2937);
      leftEye.circle(-4, -24, 2.2);
      leftEye.stroke(outline);
      leftEye.circle(-3.5, -24.4, 0.7);
      leftEye.fill(0xffffff);
      player.addChild(leftEye);

      const rightEye = new Graphics();
      rightEye.circle(4, -24, 2.2);
      rightEye.fill(0x1f2937);
      rightEye.circle(4, -24, 2.2);
      rightEye.stroke(outline);
      rightEye.circle(4.5, -24.4, 0.7);
      rightEye.fill(0xffffff);
      player.addChild(rightEye);

      const mouth = new Graphics();
      mouth.ellipse(0, -17, 2.5, 1.5);
      mouth.fill(0xe11d48);
      mouth.ellipse(0, -17, 2.5, 1.5);
      mouth.stroke(outline);
      player.addChild(mouth);

      // Hair
      const hair = new Graphics();
      hair.ellipse(0, -30, 11, 6);
      hair.fill(0x1e293b);
      hair.ellipse(0, -30, 11, 6);
      hair.stroke(outline);
      hair.ellipse(-4, -31, 5, 4);
      hair.fill(0x1e293b);
      hair.ellipse(-4, -31, 5, 4);
      hair.stroke(outline);
      hair.ellipse(4, -31, 5, 4);
      hair.fill(0x1e293b);
      hair.ellipse(4, -31, 5, 4);
      hair.stroke(outline);
      player.addChild(hair);

      // Backpack
      const backpack = new Graphics();
      backpack.roundRect(-11, -4, 8, 14, 4);
      backpack.fill(0x4f46e5);
      backpack.roundRect(-11, -4, 8, 14, 4);
      backpack.stroke(outline);
      backpack.roundRect(-10, -2, 6, 5, 2);
      backpack.fill({ color: 0x6366f1, alpha: 0.9 });
      backpack.roundRect(-9.5, 8, 5, 2.5, 1);
      backpack.fill(0x1e293b);
      backpack.roundRect(-9.5, 8, 5, 2.5, 1);
      backpack.stroke(outline);
      player.addChild(backpack);

      // Badge on chest (slightly above center)
      const badge = new Graphics();
      badge.circle(0, -2, 5);
      badge.fill(0xffd700);
      badge.circle(0, -2, 5);
      badge.stroke(outline);
      badge.circle(0, -2, 3.5);
      badge.fill(0xffed4e);
      player.addChild(badge);

      const badgeIcon = new Text({
        text: dynamicSpec?.character?.skin?.includes('medic') ? '⚕' : '⭐',
        style: new TextStyle({
          fontSize: 9,
          fill: '#1e293b',
          fontFamily: 'Arial',
          fontWeight: 'bold',
        }),
      });
      badgeIcon.anchor.set(0.5);
      badgeIcon.position.set(0, -2);
      player.addChild(badgeIcon);

      // Prefer actual Kenney model-derived frames; fallback to static preview if rendering fails.
      const playerIdleFrames = (await loadAnimationFrames('player', 'idle')) ?? (await loadKenneyCharacterFrames('player'));
      const playerWalkFrames = await loadAnimationFrames('player', 'walk');
      if (!isRenderActive()) return;
      if ((playerIdleFrames && playerIdleFrames.length > 0) || (playerWalkFrames && playerWalkFrames.length > 0)) {
        player.removeChildren();
        // Kenney sprites are already rendered characters; no upscaled container transform.
        player.scale.set(1);

        const playerShadow = new Graphics();
        playerShadow.ellipse(0, 0, 10, 5);
        playerShadow.fill({ color: 0x000000, alpha: 0.2 });
        playerShadow.position.set(0, 0);
        player.addChild(playerShadow);

        const playerBacklight = new Graphics();
        playerBacklight.circle(0, -32, 30);
        playerBacklight.fill({ color: 0xffffff, alpha: 0.14 });
        player.addChild(playerBacklight);

        const idleFrames = (playerIdleFrames && playerIdleFrames.length > 0)
          ? playerIdleFrames
          : (playerWalkFrames || []);
        playerSprite = new AnimatedSprite(idleFrames);
        playerSprite.anchor.set(0.5, 1);
        const sourceHeight = Math.max(idleFrames[0]?.height || 1, 1);
        const targetHeight = characterTargetHeight;
        const spriteScale = targetHeight / sourceHeight;
        playerSprite.scale.set(spriteScale);
        playerSprite.animationSpeed = idleFrames.length > 1 ? 0.16 : 0;
        if (idleFrames.length > 1) playerSprite.play();
        player.addChild(playerSprite);
      }

      // Add player to scroll container if scrollable, otherwise to stage
      if (scrollContainerRef.current) {
        scrollContainerRef.current.addChild(player);
      } else {
        app.stage.addChild(player);
      }

      // Doctor consultant character (always on right middle)
      const doctor = new Container();
      const doctorX = width * 0.82;
      const doctorY = height * 0.62;
      doctor.eventMode = 'static';
      doctor.cursor = 'pointer';
      doctor.on('pointertap', () => {
        // Will be handled by parent component
        (window as any).__openDoctorChat?.();
      });
      let pulseIndicator: Graphics;
      let clickableGlow: Graphics;
      const doctorSafeWidth = 104;
      const doctorSafeHeight = 166;

      const docSw = 2.5;
      const docOutline = { color: 0x000000, width: docSw };

      // Scale doctor to match player presence (2x)
      doctor.scale.set(2);

      // Doctor shadow
      const doctorShadow = new Graphics();
      doctorShadow.ellipse(0, 0, 12, 6);
      doctorShadow.fill({ color: 0x000000, alpha: 0.25 });
      doctorShadow.position.set(0, 0);
      doctor.addChild(doctorShadow);

      // Doctor legs (scrubs) - redraw path before stroke
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

      // White lab coat (chibi) with visible teal scrubs at collar
      const doctorBody = new Graphics();
      doctorBody.roundRect(-13, -10, 26, 30, 8);
      doctorBody.fill(0xffffff);
      doctorBody.roundRect(-13, -10, 26, 30, 8);
      doctorBody.stroke(docOutline);
      doctorBody.roundRect(-11, -8, 22, 8, 4);
      doctorBody.fill({ color: 0xf8fafc, alpha: 0.9 });
      // Collar / scrubs visible at neck (light teal - CoC doctor ref)
      doctorBody.roundRect(-8, -9, 16, 5, 2);
      doctorBody.fill({ color: 0x99d6ea, alpha: 0.95 });
      doctorBody.roundRect(-8, -9, 16, 5, 2);
      doctorBody.stroke(docOutline);
      doctor.addChild(doctorBody);

      // Arms
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

      // Head (chibi) with subtle highlight for volume
      const doctorHead = new Graphics();
      doctorHead.circle(0, -26, 14);
      doctorHead.fill(0xfdb68a);
      doctorHead.circle(0, -26, 14);
      doctorHead.stroke(docOutline);
      doctorHead.circle(0, -24, 11);
      doctorHead.fill({ color: 0xfec89a, alpha: 0.35 });
      doctorHead.ellipse(-5, -36, 5, 3.5);
      doctorHead.fill({ color: 0xffffff, alpha: 0.3 });
      doctor.addChild(doctorHead);

      // Head mirror (speculum) - CoC doctor style, prominent
      const headMirror = new Graphics();
      headMirror.roundRect(-14, -44, 28, 5, 2);
      headMirror.fill(0xcbd5e1);
      headMirror.roundRect(-14, -44, 28, 5, 2);
      headMirror.stroke(docOutline);
      headMirror.circle(0, -46, 6);
      headMirror.fill(0xf1f5f9);
      headMirror.circle(0, -46, 6);
      headMirror.stroke(docOutline);
      headMirror.circle(0, -46, 2.5);
      headMirror.fill(0xffffff);
      // Mirror glass highlight (2D-that-looks-3D)
      headMirror.ellipse(-1.5, -47, 1.2, 0.8);
      headMirror.fill({ color: 0xffffff, alpha: 0.7 });
      doctor.addChild(headMirror);

      // Beard
      const beard = new Graphics();
      beard.ellipse(0, -18, 9, 7);
      beard.fill(0xa8b2c1);
      beard.ellipse(0, -18, 9, 7);
      beard.stroke(docOutline);
      beard.ellipse(0, -15, 8, 5);
      beard.fill({ color: 0x9ca3af, alpha: 0.8 });
      doctor.addChild(beard);

      const mustache = new Graphics();
      mustache.ellipse(-4, -22, 4, 2.5);
      mustache.fill(0xa8b2c1);
      mustache.ellipse(-4, -22, 4, 2.5);
      mustache.stroke(docOutline);
      mustache.ellipse(4, -22, 4, 2.5);
      mustache.fill(0xa8b2c1);
      mustache.ellipse(4, -22, 4, 2.5);
      mustache.stroke(docOutline);
      doctor.addChild(mustache);

      // Glasses (thick frames)
      const leftGlass = new Graphics();
      leftGlass.circle(-5, -26, 4.5);
      leftGlass.stroke({ color: 0x1f2937, width: 2 });
      doctor.addChild(leftGlass);

      const rightGlass = new Graphics();
      rightGlass.circle(5, -26, 4.5);
      rightGlass.stroke({ color: 0x1f2937, width: 2 });
      doctor.addChild(rightGlass);

      const glassBridge = new Graphics();
      glassBridge.roundRect(-2, -26, 4, 1.5, 0.5);
      glassBridge.fill(0x1f2937);
      doctor.addChild(glassBridge);

      // Eyes
      const docLeftEye = new Graphics();
      docLeftEye.circle(-5, -27, 2);
      docLeftEye.fill(0x1f2937);
      doctor.addChild(docLeftEye);

      const docRightEye = new Graphics();
      docRightEye.circle(5, -27, 2);
      docRightEye.fill(0x1f2937);
      doctor.addChild(docRightEye);

      // Stethoscope (silver/grey)
      const stethoscope = new Graphics();
      stethoscope.roundRect(-2.5, 2, 5, 14, 2);
      stethoscope.stroke({ color: 0x64748b, width: 2.5 });
      stethoscope.circle(0, 17, 4);
      stethoscope.stroke({ color: 0x64748b, width: 2.5 });
      stethoscope.circle(0, 17, 1.5);
      stethoscope.fill(0x94a3b8);
      doctor.addChild(stethoscope);

      // DR badge
      const doctorBadge = new Graphics();
      doctorBadge.roundRect(-7, -4, 14, 5, 2);
      doctorBadge.fill(0x3b82f6);
      doctorBadge.roundRect(-7, -4, 14, 5, 2);
      doctorBadge.stroke(docOutline);
      doctor.addChild(doctorBadge);

      const doctorBadgeText = new Text({
        text: 'DR',
        style: new TextStyle({
          fontSize: 8,
          fill: '#ffffff',
          fontFamily: 'Arial',
          fontWeight: 'bold',
        }),
      });
      doctorBadgeText.anchor.set(0.5);
      doctorBadgeText.position.set(0, -2);
      doctor.addChild(doctorBadgeText);

      // Pulse indicator (subtle animation)
      pulseIndicator = new Graphics();
      pulseIndicator.circle(0, 18, 2);
      pulseIndicator.fill({ color: 0xef4444, alpha: 0.8 });
      doctor.addChild(pulseIndicator);

      // Clickable indicator glow
      clickableGlow = new Graphics();
      clickableGlow.circle(0, 0, 35);
      clickableGlow.fill({ color: 0x3b82f6, alpha: 0.15 });
      clickableGlow.circle(0, 0, 30);
      clickableGlow.fill({ color: 0x3b82f6, alpha: 0.1 });
      doctor.addChildAt(clickableGlow, 0); // Add behind everything

      // "Tap to chat" text hint
      const chatHint = new Text({
        text: '💬',
        style: new TextStyle({
          fontSize: 16,
          fontFamily: 'Arial',
        }),
      });
      chatHint.anchor.set(0.5);
      chatHint.position.set(0, -35);
      doctor.addChild(chatHint);

      // Prefer actual Kenney model-derived doctor frames; fallback to static preview if needed.
      const doctorFrames = (await loadAnimationFrames('doctor', 'idle')) ?? (await loadKenneyCharacterFrames('doctor'));
      if (!isRenderActive()) return;
      if (doctorFrames && doctorFrames.length > 0) {
        doctor.removeChildren();
        doctor.scale.set(1);

        clickableGlow = new Graphics();
        clickableGlow.circle(0, 0, 40);
        clickableGlow.fill({ color: 0x3b82f6, alpha: 0.13 });
        clickableGlow.circle(0, 0, 34);
        clickableGlow.fill({ color: 0x3b82f6, alpha: 0.08 });
        doctor.addChild(clickableGlow);

        const doctorShadow = new Graphics();
        doctorShadow.ellipse(0, 0, 10, 5);
        doctorShadow.fill({ color: 0x000000, alpha: 0.2 });
        doctorShadow.position.set(0, 0);
        doctor.addChild(doctorShadow);

        const doctorBacklight = new Graphics();
        doctorBacklight.circle(0, -34, 32);
        doctorBacklight.fill({ color: 0xffffff, alpha: 0.16 });
        doctor.addChild(doctorBacklight);

        const doctorSprite = new AnimatedSprite(doctorFrames);
        doctorSprite.anchor.set(0.5, 1);
        const sourceHeight = Math.max(doctorFrames[0].height || 1, 1);
        const targetHeight = characterTargetHeight;
        const spriteScale = targetHeight / sourceHeight;
        doctorSprite.scale.set(spriteScale);
        doctorSprite.animationSpeed = doctorFrames.length > 1 ? 0.16 : 0;
        if (doctorFrames.length > 1) doctorSprite.play();
        doctor.addChild(doctorSprite);

        pulseIndicator = new Graphics();
        pulseIndicator.circle(0, 20, 2.2);
        pulseIndicator.fill({ color: 0xef4444, alpha: 0.8 });
        doctor.addChild(pulseIndicator);

        const doctorHint = new Text({
          text: '💬',
          style: new TextStyle({
            fontSize: 16,
            fontFamily: 'Arial',
          }),
        });
        doctorHint.anchor.set(0.5);
        doctorHint.position.set(0, -42);
        doctor.addChild(doctorHint);
      }

      const activeIdx = Math.max(0, Math.min(completed, nodePoints.length - 1));
      const mapProgressNode = nodePoints[activeIdx] || nodePoints[0];
      const startAnchorNode = startFlagPoint;
      const progressIdx = Math.max(-1, Math.min(completed - 1, nodePoints.length - 1));
      const mapKey = `${imageUrl || 'no-image'}:${nodePoints.length}:${total}`;
      if (lastMapKeyRef.current !== mapKey) {
        lastMapKeyRef.current = mapKey;
        lastCompletedRef.current = progressIdx;
      }
      const previousProgress = Math.max(-1, Math.min(lastCompletedRef.current, nodePoints.length - 1));
      const shouldPlayWalk = progressIdx > previousProgress;
      const prevNode = previousProgress >= 0 ? nodePoints[previousProgress] : startAnchorNode;
      const currentNode = progressIdx >= 0 ? nodePoints[progressIdx] : startAnchorNode;
      lastCompletedRef.current = progressIdx;

      const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
      const safeMargin = 12;
      const clampFootPoint = (px: number, py: number, charW: number, charH: number) => {
        let maxH = height;
        if (scrollContainerRef.current) {
          const mapImage = scrollContainerRef.current.children.find(
            (child: any) => child instanceof Sprite
          ) as Sprite | undefined;
          if (mapImage) {
            maxH = mapImage.height;
          }
        }
        return {
          x: clamp(px, safeMargin + charW / 2, width - safeMargin - charW / 2),
          y: clamp(py, safeMargin + charH, maxH - safeMargin),
        };
      };

      // Pick the best side around a node so full character remains visible.
      const getPlayerFootForNode = (node: { x: number; y: number }) => {
        let cx: number, cy: number;
        
        if (scrollContainerRef.current) {
          // For scrollable maps: node coordinates are relative to map image (normalized 0-1)
          // Map image is scaled to fit width, positioned at y=0 in scroll container
          const mapImage = scrollContainerRef.current.children.find((child: any) => child instanceof Sprite) as Sprite | undefined;
          if (mapImage) {
            const mapWidth = mapImage.width;
            const mapHeight = mapImage.height;
            // Map sprite is centered: mapImage.x offsets content; y=0 is top of map
            cx = mapImage.x + node.x * mapWidth;
            cy = node.y * mapHeight;
          } else {
            // Fallback
            cx = node.x * width;
            cy = node.y * height;
          }
        } else {
          // Regular map: coordinates relative to viewport
          cx = node.x * width;
          cy = node.y * height;
        }
        
        const candidates = [
          { x: cx - 54, y: cy + 10, pref: 1.0 }, // left (preferred)
          { x: cx + 54, y: cy + 10, pref: 0.85 }, // right
          { x: cx - 44, y: cy + 54, pref: 0.75 }, // down-left
          { x: cx + 44, y: cy + 54, pref: 0.7 }, // down-right
          { x: cx, y: cy + 62, pref: 0.6 }, // down-center
        ];
        let best = clampFootPoint(candidates[0].x, candidates[0].y, playerSafeWidth, playerSafeHeight);
        let bestScore = -Infinity;
        for (const c of candidates) {
          const clamped = clampFootPoint(c.x, c.y, playerSafeWidth, playerSafeHeight);
          const penalty = Math.abs(clamped.x - c.x) + Math.abs(clamped.y - c.y);
          const score = c.pref * 100 - penalty;
          if (score > bestScore) {
            bestScore = score;
            best = clamped;
          }
        }
        return best;
      };

      const startPos = getPlayerFootForNode(prevNode);

      // Doctor follows player: ~1 star distance to the side (in same scroll space as player)
      const doctorContainer = new Container();
      doctorContainer.addChild(doctor);
      doctorContainer.zIndex = 1000;
      const doctorOffsetX = 72;
      const doctorOffsetY = -8;
      if (scrollContainerRef.current) {
        scrollContainerRef.current.addChild(doctorContainer);
        doctorContainer.position.set(startPos.x + doctorOffsetX, startPos.y + doctorOffsetY);
      } else {
        app.stage.addChild(doctorContainer);
        doctorContainer.position.set(doctorX, doctorY);
      }
      const currentPos = getPlayerFootForNode(currentNode);
      const startX = startPos.x;
      const startY = startPos.y;
      let targetX = currentPos.x;
      let targetY = currentPos.y;
      let x = shouldPlayWalk ? startX : targetX;
      let y = shouldPlayWalk ? startY : targetY;
      const walkDurationMs = 2200;
      const walkStart = performance.now();
      let isWalkingToNext = shouldPlayWalk;
      let isPlayerWalkingAnim = shouldPlayWalk;

      player.position.set(x, y);
      
      // Store references for animation
      const playerParts = {
        torso,
        head,
        hair,
        leftLeg,
        rightLeg,
        leftFoot,
        rightFoot,
        leftArm,
        rightArm,
      };

      // Animated particles (only if no image background to avoid visual clutter)
      let particleContainer: Container | null = null;
      if (!hasImageBackground) {
        particleContainer = new Container();
        const particles = themeData.particles;
        for (let i = 0; i < particles.count; i++) {
          const p = new Graphics();
          const size = 2 + Math.random() * 3;
          p.circle(0, 0, size);
          p.fill({ color: particles.color, alpha: 0.3 + Math.random() * 0.4 });
          p.position.set(Math.random() * width, Math.random() * height);
          (p as any)._vx = (Math.random() - 0.5) * particles.speed;
          (p as any)._vy = (Math.random() - 0.5) * particles.speed * 0.5;
          particleContainer.addChild(p);
        }
        app.stage.addChild(particleContainer);
      }

      // Animation ticker
      let tick = 0;
      app.ticker.add(() => {
        if (!isRenderActive()) return;
        tick += 0.03;
        const liveProgressIdx = Math.max(-1, Math.min(completed - 1, nodePoints.length - 1));
        const liveCurrent = liveProgressIdx >= 0 ? nodePoints[liveProgressIdx] : startAnchorNode;
        const livePos = getPlayerFootForNode(liveCurrent || mapProgressNode || { x: 0.1, y: 0.8 });
        targetX = livePos.x;
        targetY = livePos.y;

        if (isWalkingToNext) {
          const t = Math.min(1, (performance.now() - walkStart) / walkDurationMs);
          x = startX + (targetX - startX) * t;
          y = startY + (targetY - startY) * t;
          if (t >= 1) {
            isWalkingToNext = false;
            isPlayerWalkingAnim = false;
          }
        } else {
          x += (targetX - x) * 0.12;
          y += (targetY - y) * 0.12;
        }

        // Hard keep in viewport (head-to-toe) after movement interpolation.
        const playerClamped = clampFootPoint(x, y, playerSafeWidth, playerSafeHeight);
        x = playerClamped.x;
        y = playerClamped.y;

        const bob = isWalkingToNext ? Math.sin(tick * 7) * 1.1 : 0;
        const breathe = Math.sin(tick * 2.1);
        const walk = Math.sin(tick * 4.5);
        
        // Player position and animation
        player.position.set(x, y + bob);
        player.rotation = isWalkingToNext ? Math.sin(tick * 1.2) * 0.02 : 0;

        // Switch sprite animation state: idle by default, walk only while moving between checkpoints.
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
        
        // Breathing animation for torso
        playerParts.torso.scale.y = 1 + breathe * 0.03;
        playerParts.torso.scale.x = 1 - breathe * 0.01;
        
        // Head bobbing
        playerParts.head.y = -18 + breathe * 0.6;
        playerParts.hair.y = -24 + breathe * 0.5;
        
        // Walking animation for legs
        playerParts.leftLeg.rotation = walk * 0.15;
        playerParts.rightLeg.rotation = -walk * 0.15;
        playerParts.leftFoot.rotation = walk * 0.1;
        playerParts.rightFoot.rotation = -walk * 0.1;
        
        // Arm swing
        playerParts.leftArm.rotation = -walk * 0.2;
        playerParts.rightArm.rotation = walk * 0.2;
        
        // Doctor follows player (when in scroll container); otherwise fixed
        if (scrollContainerRef.current) {
          doctorContainer.position.x = x + doctorOffsetX;
          doctorContainer.position.y = y + doctorOffsetY;
          doctor.rotation = 0;
        } else {
          const doctorMarginX = Math.max(12, doctorSafeWidth * 0.5 + 8);
          const doctorMinY = doctorSafeHeight + 10;
          const doctorMaxY = height - 8;
          doctorContainer.position.x = Math.max(doctorMarginX, Math.min(width - doctorMarginX, doctorX));
          doctorContainer.position.y = Math.max(doctorMinY, Math.min(doctorMaxY, doctorY));
          doctor.rotation = 0;
        }
        
        // Pulse indicator animation
        const pulse = Math.sin(tick * 6) * 0.5 + 0.5;
        pulseIndicator.scale.set(1 + pulse * 0.3);
        pulseIndicator.alpha = 0.6 + pulse * 0.4;
        
        // Clickable glow pulse
        const glowPulse = Math.sin(tick * 3) * 0.5 + 0.5;
        clickableGlow.alpha = 0.1 + glowPulse * 0.1;
        clickableGlow.scale.set(1 + glowPulse * 0.1);
        
        // Animate current checkpoint glow
        pathContainer.children.forEach((child: any) => {
          if (child._isCurrent && child._glowContainer) {
            const pulse = Math.sin(tick * 4) * 0.5 + 0.5;
            child.scale.set(1 + pulse * 0.03);
            child._glowContainer.scale.set(1 + pulse * 0.15);
            child._glowContainer.alpha = 0.6 + pulse * 0.4;
          }
        });

        if (parallaxContainer) {
          parallaxContainer.children.forEach((silhouette: any, idx) => {
            const speed = silhouette._parallaxSpeed || 0.12;
            silhouette.x = Math.sin(tick * speed + idx) * 4;
          });
        }

        // Only animate particles if they exist (no image background)
        if (particleContainer) {
          particleContainer.children.forEach((p: any) => {
            p.x += p._vx;
            p.y += p._vy;
            if (p.x > width) p.x = 0;
            if (p.x < 0) p.x = width;
            if (p.y > height) p.y = 0;
            if (p.y < 0) p.y = height;
          });
        }
      });
    },
    [onCheckpointClick, checklistItems, eventsPerStar]
  );

  useEffect(() => {
    if (!containerRef.current) return;

    const initApp = async () => {
      // Clean up previous app
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }

      const app = new Application();
      let lastWidth = 0;
      let lastHeight = 0;
      const updateSize = () => {
        if (!containerRef.current || !appRef.current) return;
        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;
        
        // Only re-draw if size changed significantly (more than 10px difference)
        const sizeChanged = Math.abs(width - lastWidth) > 10 || Math.abs(height - lastHeight) > 10;
        
        if (sizeChanged || lastWidth === 0 || lastHeight === 0) {
          lastWidth = width;
          lastHeight = height;
          appRef.current.renderer.resize(width, height);
          // Re-draw map with new dimensions
          const themeData = getTheme(theme);
          drawMap(appRef.current, themeData, completedCount, totalCount, mapSpec, mapImageUrl).catch(console.error);
        } else {
          // Just resize renderer for minor changes
          appRef.current.renderer.resize(width, height);
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

      // Initialize dimensions
      lastWidth = containerRef.current!.clientWidth;
      lastHeight = containerRef.current!.clientHeight;

      const themeData = getTheme(theme);
      drawMap(app, themeData, completedCount, totalCount, mapSpec, mapImageUrl).catch(console.error);

      // Add touch/scroll handlers for scrollable maps
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
      
      const handleTouchEnd = () => {
        isDragging = false;
      };
      
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
      
      // Store handlers for cleanup
      (app as any).__touchHandlers = { handleTouchStart, handleTouchMove, handleTouchEnd, handleWheel };

      // Add resize observer for container
      const resizeObserver = new ResizeObserver(() => {
        updateSize();
      });
      if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
      }

      // Also listen to window resize for mobile orientation changes
      const handleWindowResize = () => {
        // Debounce rapid resize events
        clearTimeout((window as any).__gameCanvasResizeTimeout);
        (window as any).__gameCanvasResizeTimeout = setTimeout(() => {
          updateSize();
        }, 100);
      };
      window.addEventListener('resize', handleWindowResize);
      window.addEventListener('orientationchange', handleWindowResize);

      // Store cleanup functions
      (app as any).__resizeObserver = resizeObserver;
      (app as any).__resizeHandler = handleWindowResize;
    };

    initApp();

    return () => {
      if (appRef.current) {
        // Clean up resize observer
        if ((appRef.current as any).__resizeObserver) {
          (appRef.current as any).__resizeObserver.disconnect();
        }
        // Clean up window listeners
        if ((appRef.current as any).__resizeHandler) {
          window.removeEventListener('resize', (appRef.current as any).__resizeHandler);
          window.removeEventListener('orientationchange', (appRef.current as any).__resizeHandler);
        }
        // Clean up touch/scroll handlers
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
  }, [theme, completedCount, totalCount, mapSpec, mapImageUrl, drawMap]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden"
    />
  );
}


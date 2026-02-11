'use client';
import { useEffect, useRef, useCallback } from 'react';
import { Application, Graphics, Container, Text, TextStyle, Sprite, Assets } from 'pixi.js';
import { getTheme, GameTheme } from './themes';
import type { PersonalizedMapSpec } from '@/stores/gameStore';

interface ChecklistItem {
  _id: string;
  title: string;
  description: string;
  frequency: string;
  isCompleted: boolean;
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
  onCheckpointClick?: (index: number) => void;
}

export default function GameCanvas({
  theme,
  completedCount,
  totalCount,
  mapSpec,
  mapImageUrl,
  checklistItems = [],
  onCheckpointClick,
}: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);

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

  const drawMap = useCallback(
    async (
      app: Application,
      themeData: GameTheme,
      completed: number,
      total: number,
      dynamicSpec?: PersonalizedMapSpec | null,
      imageUrl?: string | null
    ) => {
      const { width, height } = app.screen;

      // Clear existing children
      while (app.stage.children.length > 0) {
        app.stage.removeChildAt(0);
      }

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
          const mapSprite = new Sprite(texture);
          
          // Scale to COVER canvas while maintaining aspect ratio (full-screen map feel)
          const scale = Math.max(width / texture.width, height / texture.height);
          mapSprite.scale.set(scale);
          mapSprite.x = (width - texture.width * scale) / 2;
          mapSprite.y = (height - texture.height * scale) / 2;
          
          app.stage.addChild(mapSprite);
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

      // Draw path
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

      // Draw path line (only connecting checkpoints, no intermediate dots)
      for (let i = 0; i < nodePoints.length - 1; i++) {
        const p1 = { x: nodePoints[i].x * width, y: nodePoints[i].y * height };
        const p2 = { x: nodePoints[i + 1].x * width, y: nodePoints[i + 1].y * height };

        pathGraphics.moveTo(p1.x, p1.y);
        pathGraphics.lineTo(p2.x, p2.y);
        pathGraphics.stroke({
          color: secondaryColor,
          width: 6,
          alpha: 0.4,
        });

        // Inner road lighting
        pathGraphics.moveTo(p1.x, p1.y);
        pathGraphics.lineTo(p2.x, p2.y);
        pathGraphics.stroke({ color: 0xffffff, width: 2, alpha: 0.15 });

        // Completed segment glow
        if (i < completed) {
          progressGraphics.moveTo(p1.x, p1.y);
          progressGraphics.lineTo(p2.x, p2.y);
          progressGraphics.stroke({ color: primaryColor, width: 5, alpha: 0.7 });
        }
      }
      pathContainer.addChild(pathGraphics);
      pathContainer.addChild(progressGraphics);

      // Draw checkpoints (only numbered ones, no intermediate dots)
      nodePoints.forEach((point, index) => {
        const cx = point.x * width;
        const cy = point.y * height;
        const isCompleted = index < completed;
        const isCurrent = index === completed;
        const isLocked = index > completed;

        const checkpoint = new Graphics();

        // Outer glow for current checkpoint
        if (isCurrent) {
          checkpoint.circle(cx, cy, 28);
          checkpoint.fill({ color: accentColor, alpha: 0.3 });
          checkpoint.circle(cx, cy, 24);
          checkpoint.fill({ color: accentColor, alpha: 0.4 });
        }

        // Main checkpoint circle - larger and more visible
        const circleRadius = 20;
        checkpoint.circle(cx, cy, circleRadius);
        if (isCompleted) {
          checkpoint.fill(primaryColor);
        } else if (isCurrent) {
          checkpoint.fill(primaryColor);
        } else {
          checkpoint.fill({ color: 0x6b7280, alpha: 0.7 });
        }

        // Border - thicker and more visible
        checkpoint.circle(cx, cy, circleRadius);
        checkpoint.stroke({ 
          color: isLocked ? 0x4b5563 : 0xffffff, 
          width: 3, 
          alpha: isLocked ? 0.5 : 1.0 
        });

        // White inner circle for better contrast
        if (!isLocked) {
          checkpoint.circle(cx, cy, circleRadius - 2);
          checkpoint.stroke({ color: 0xffffff, width: 1, alpha: 0.3 });
        }

        checkpoint.eventMode = 'static';
        checkpoint.cursor = 'pointer';
        checkpoint.on('pointertap', () => onCheckpointClick?.(index));
        pathContainer.addChild(checkpoint);

        // Checkpoint number - larger and clearer
        const label = new Text({
          text: isCompleted ? '✓' : `${index + 1}`,
          style: new TextStyle({
            fontSize: isCompleted ? 18 : 16,
            fill: isCompleted ? '#ffffff' : isLocked ? '#9ca3af' : '#ffffff',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            dropShadow: true,
          }),
        });
        label.anchor.set(0.5);
        label.position.set(cx, cy);
        pathContainer.addChild(label);
      });

      app.stage.addChild(pathContainer);
      app.stage.addChild(decorFront);

      // Player character (cute 2D character with subtle breathing motion)
      const player = new Container();

      const playerShadow = new Graphics();
      playerShadow.ellipse(0, 0, 11, 5.5);
      playerShadow.fill({ color: 0x000000, alpha: 0.28 });
      playerShadow.position.set(0, 18);
      player.addChild(playerShadow);

      const backpack = new Graphics();
      backpack.roundRect(-11, -7, 8, 14, 3);
      backpack.fill(0x4f46e5);
      backpack.roundRect(-10, -6, 6, 5, 2);
      backpack.fill({ color: 0xffffff, alpha: 0.25 });
      player.addChild(backpack);

      const torso = new Graphics();
      torso.roundRect(-8, -6, 16, 18, 7);
      torso.fill(0x38bdf8);
      torso.roundRect(-6, -4, 12, 4, 2);
      torso.fill({ color: 0xffffff, alpha: 0.35 });
      player.addChild(torso);

      const head = new Graphics();
      head.circle(0, -16, 8);
      head.fill(0xfec89a);
      head.circle(-2.5, -17, 0.9);
      head.circle(2.5, -17, 0.9);
      head.fill(0x1f2937);
      head.ellipse(0, -13.5, 2.4, 1.2);
      head.fill({ color: 0xef4444, alpha: 0.45 });
      player.addChild(head);

      const hair = new Graphics();
      hair.ellipse(0, -20.5, 7.5, 3.2);
      hair.fill(0x334155);
      player.addChild(hair);

      const playerBadge = new Text({
        text: dynamicSpec?.character?.skin?.includes('medic') ? '🧪' : '🧭',
        style: new TextStyle({
          fontSize: 11,
          fontFamily: 'Arial',
        }),
      });
      playerBadge.anchor.set(0.5);
      playerBadge.position.set(0, -31);
      player.addChild(playerBadge);
      app.stage.addChild(player);

      const currentIdx = Math.max(0, Math.min(completed, nodePoints.length - 1));
      const currentNode = nodePoints[currentIdx] || nodePoints[0];
      let targetX = currentNode.x * width;
      let targetY = currentNode.y * height - 24;
      let x = targetX;
      let y = targetY;

      player.position.set(x, y);

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
        tick += 0.03;
        const liveCurrent = nodePoints[Math.max(0, Math.min(completed, nodePoints.length - 1))];
        targetX = (liveCurrent?.x || 0.1) * width;
        targetY = (liveCurrent?.y || 0.8) * height - 24;
        x += (targetX - x) * 0.11;
        y += (targetY - y) * 0.11;
        const bob = Math.sin(tick * 3.2) * 2.2;
        const breathe = Math.sin(tick * 2.1);
        player.position.set(x, y + bob);
        player.rotation = Math.sin(tick * 1.2) * 0.02;
        torso.scale.y = 1 + breathe * 0.035;
        torso.scale.x = 1 - breathe * 0.015;
        head.y = breathe * 0.7;
        hair.y = breathe * 0.55;

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
    [onCheckpointClick]
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

      const themeData = getTheme(theme);
      drawMap(app, themeData, completedCount, totalCount, mapSpec, mapImageUrl).catch(console.error);
    };

    initApp();

    return () => {
      if (appRef.current) {
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


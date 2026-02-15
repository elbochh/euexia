'use client';
import { useEffect, useRef, useCallback } from 'react';
import { Application, Graphics, Container, Text, TextStyle } from 'pixi.js';
import { getTheme, GameTheme } from './themes';
import type { PersonalizedMapSpec } from '@/stores/gameStore';

interface GameCanvasProps {
  theme: string;
  completedCount: number;
  totalCount: number;
  mapSpec?: PersonalizedMapSpec | null;
  onCheckpointClick?: (index: number) => void;
}

export default function GameCanvas({
  theme,
  completedCount,
  totalCount,
  mapSpec,
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
    (
      app: Application,
      themeData: GameTheme,
      completed: number,
      total: number,
      dynamicSpec?: PersonalizedMapSpec | null
    ) => {
      const { width, height } = app.screen;

      // Clear existing children
      while (app.stage.children.length > 0) {
        app.stage.removeChildAt(0);
      }

      const skyColor = dynamicSpec?.palette?.sky
        ? hexToNumber(dynamicSpec.palette.sky, themeData.skyColors[0])
        : themeData.skyColors[0];
      const groundColor = dynamicSpec?.palette?.ground
        ? hexToNumber(dynamicSpec.palette.ground, themeData.groundColor)
        : themeData.groundColor;
      const accentColor = dynamicSpec?.palette?.accent
        ? hexToNumber(dynamicSpec.palette.accent, themeData.checkpointGlow)
        : themeData.checkpointGlow;
      const primaryColor = dynamicSpec?.palette?.primary
        ? hexToNumber(dynamicSpec.palette.primary, themeData.checkpointColor)
        : themeData.checkpointColor;
      const secondaryColor = dynamicSpec?.palette?.secondary
        ? hexToNumber(dynamicSpec.palette.secondary, themeData.pathColor)
        : themeData.pathColor;

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
      const parallaxContainer = new Container();
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
        parallaxContainer.addChild(silhouette);
      });
      app.stage.addChild(parallaxContainer);

      // --- Layer 4: Decor assets ---
      const decorBack = new Container();
      const decorMid = new Container();
      const decorFront = new Container();
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

      // Draw dotted path line
      for (let i = 0; i < pathPoints.length - 1; i++) {
        const p1 = { x: pathPoints[i].x * width, y: pathPoints[i].y * height };
        const p2 = { x: pathPoints[i + 1].x * width, y: pathPoints[i + 1].y * height };

        pathGraphics.moveTo(p1.x, p1.y);
        pathGraphics.lineTo(p2.x, p2.y);
        pathGraphics.stroke({
          color: secondaryColor,
          width: 8,
          alpha: 0.45,
        });

        // Inner road lighting
        pathGraphics.moveTo(p1.x, p1.y);
        pathGraphics.lineTo(p2.x, p2.y);
        pathGraphics.stroke({ color: 0xffffff, width: 2, alpha: 0.2 });

        // Completed segment glow
        if (i < completed) {
          progressGraphics.moveTo(p1.x, p1.y);
          progressGraphics.lineTo(p2.x, p2.y);
          progressGraphics.stroke({ color: primaryColor, width: 6, alpha: 0.78 });
        }
      }
      pathContainer.addChild(pathGraphics);
      pathContainer.addChild(progressGraphics);

      // Draw checkpoints
      nodePoints.forEach((point, index) => {
        const cx = point.x * width;
        const cy = point.y * height;
        const isCompleted = index < completed;
        const isCurrent = index === completed;
        const isLocked = index > completed;

        const checkpoint = new Graphics();

        if (isCurrent) {
          // Glow for current
          checkpoint.circle(cx, cy, 22);
          checkpoint.fill({ color: accentColor, alpha: 0.35 });
          checkpoint.circle(cx, cy, 18);
          checkpoint.fill({ color: accentColor, alpha: 0.5 });
        }

        // Checkpoint circle
        checkpoint.circle(cx, cy, 14);
        if (isCompleted) {
          checkpoint.fill(primaryColor);
        } else if (isCurrent) {
          checkpoint.fill(primaryColor);
        } else {
          checkpoint.fill({ color: 0x6b7280, alpha: 0.6 });
        }

        // Border
        checkpoint.circle(cx, cy, 14);
        checkpoint.stroke({ color: isLocked ? 0x4b5563 : 0xffffff, width: 2, alpha: isLocked ? 0.4 : 0.8 });

        checkpoint.eventMode = 'static';
        checkpoint.cursor = 'pointer';
        checkpoint.on('pointertap', () => onCheckpointClick?.(index));
        pathContainer.addChild(checkpoint);

        // Checkpoint number/icon
        const label = new Text({
          text: isCompleted ? '✓' : `${index + 1}`,
          style: new TextStyle({
            fontSize: isCompleted ? 14 : 11,
            fill: isCompleted ? '#ffffff' : isLocked ? '#9ca3af' : '#ffffff',
            fontFamily: 'Fredoka',
            fontWeight: 'bold',
          }),
        });
        label.anchor.set(0.5);
        label.position.set(cx, cy);
        pathContainer.addChild(label);
      });

      app.stage.addChild(pathContainer);
      app.stage.addChild(decorFront);

      // Player avatar container
      const player = new Container();
      const playerShadow = new Graphics();
      playerShadow.ellipse(0, 0, 10, 5);
      playerShadow.fill({ color: 0x000000, alpha: 0.3 });
      playerShadow.position.set(0, 13);
      player.addChild(playerShadow);

      const playerBody = new Graphics();
      playerBody.circle(0, 0, 10);
      playerBody.fill(0xff7f50);
      playerBody.circle(0, 0, 10);
      playerBody.stroke({ color: 0xffffff, width: 2 });
      player.addChild(playerBody);

      const playerBadge = new Text({
        text: dynamicSpec?.character?.skin?.includes('medic') ? '🧪' : '🧭',
        style: new TextStyle({
          fontSize: 12,
          fontFamily: 'Fredoka',
        }),
      });
      playerBadge.anchor.set(0.5);
      playerBadge.position.set(0, -18);
      player.addChild(playerBadge);
      app.stage.addChild(player);

      const currentIdx = Math.max(0, Math.min(completed, nodePoints.length - 1));
      const currentNode = nodePoints[currentIdx] || nodePoints[0];
      let targetX = currentNode.x * width;
      let targetY = currentNode.y * height - 24;
      let x = targetX;
      let y = targetY;

      player.position.set(x, y);

      // Animated particles
      const particleContainer = new Container();
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

      // Animation ticker
      let tick = 0;
      app.ticker.add(() => {
        tick += 0.03;
        const liveCurrent = nodePoints[Math.max(0, Math.min(completed, nodePoints.length - 1))];
        targetX = (liveCurrent?.x || 0.1) * width;
        targetY = (liveCurrent?.y || 0.8) * height - 24;
        x += (targetX - x) * 0.11;
        y += (targetY - y) * 0.11;
        player.position.set(x, y + Math.sin(tick * 3.2) * 2.5);

        parallaxContainer.children.forEach((silhouette: any, idx) => {
          const speed = silhouette._parallaxSpeed || 0.12;
          silhouette.x = Math.sin(tick * speed + idx) * 4;
        });

        particleContainer.children.forEach((p: any) => {
          p.x += p._vx;
          p.y += p._vy;
          if (p.x > width) p.x = 0;
          if (p.x < 0) p.x = width;
          if (p.y > height) p.y = 0;
          if (p.y < 0) p.y = height;
        });
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
      drawMap(app, themeData, completedCount, totalCount, mapSpec);
    };

    initApp();

    return () => {
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
    };
  }, [theme, completedCount, totalCount, mapSpec, drawMap]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-2xl overflow-hidden border-2 border-white/10"
      style={{ height: '55vh', minHeight: '350px' }}
    />
  );
}


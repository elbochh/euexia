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
        const p1 = { x: nodePoints[i].x * width, y: nodePoints[i].y * height };
        const p2 = { x: nodePoints[i + 1].x * width, y: nodePoints[i + 1].y * height };
        
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

      // Draw checkpoints - Clash of Clans style with detailed borders
      nodePoints.forEach((point, index) => {
        const cx = point.x * width;
        const cy = point.y * height;
        const isCompleted = index < completed;
        const isCurrent = index === completed;
        const isLocked = index > completed;

        const checkpoint = new Container();
        checkpoint.position.set(cx, cy);
        checkpoint.eventMode = 'static';
        checkpoint.cursor = 'pointer';
        checkpoint.on('pointertap', () => onCheckpointClick?.(index));
        
        const checkpointGraphics = new Graphics();
        const circleRadius = 24;

        // Single subtle shadow (reduced)
        checkpointGraphics.circle(0, 2, circleRadius);
        checkpointGraphics.fill({ color: 0x000000, alpha: 0.25 });

        // Outer glow ring for current/active checkpoint (separate container for animation)
        let currentGlowContainer: Container | null = null;
        if (isCurrent && !isLocked) {
          currentGlowContainer = new Container();
          const glowGraphics = new Graphics();
          // Multiple glow layers
          glowGraphics.circle(0, 0, 38);
          glowGraphics.fill({ color: accentColor, alpha: 0.15 });
          glowGraphics.circle(0, 0, 34);
          glowGraphics.fill({ color: accentColor, alpha: 0.25 });
          glowGraphics.circle(0, 0, 30);
          glowGraphics.fill({ color: accentColor, alpha: 0.35 });
          currentGlowContainer.addChild(glowGraphics);
          checkpoint.addChildAt(currentGlowContainer, 0); // Add behind main graphics
          (currentGlowContainer as any)._isCurrentGlow = true;
        }

        // Main circle background - Clash of Clans style
        if (isCompleted) {
          // Completed: light green (Clash of Clans style)
          checkpointGraphics.circle(0, 0, circleRadius);
          checkpointGraphics.fill({ color: 0x4ade80, alpha: 1.0 }); // Light green
          checkpointGraphics.circle(0, -1, circleRadius - 1);
          checkpointGraphics.fill({ color: 0x86efac, alpha: 0.8 }); // Lighter green highlight
        } else if (isCurrent && !isLocked) {
          // Current: accent color
          checkpointGraphics.circle(0, 0, circleRadius);
          checkpointGraphics.fill({ color: accentColor, alpha: 1.0 });
        } else {
          // Not done: grey (Clash of Clans style)
          checkpointGraphics.circle(0, 0, circleRadius);
          checkpointGraphics.fill({ color: 0x6b7280, alpha: 1.0 }); // Grey base
          checkpointGraphics.circle(0, -1, circleRadius - 1);
          checkpointGraphics.fill({ color: 0x9ca3af, alpha: 0.6 }); // Lighter grey highlight
        }

        // Outer border - Clash of Clans style (simplified)
        checkpointGraphics.circle(0, 0, circleRadius);
        checkpointGraphics.stroke({ 
          color: isCompleted ? 0xffffff : isCurrent ? 0xffffff : 0x4b5563, 
          width: 3, 
          alpha: 1.0 
        });
        
        // Inner border for depth (subtle)
        checkpointGraphics.circle(0, 0, circleRadius - 2);
        checkpointGraphics.stroke({ 
          color: isCompleted ? 0x000000 : isCurrent ? 0x000000 : 0x1f2937, 
          width: 1, 
          alpha: 0.3 
        });

        // Subtle top highlight (reduced)
        if (!isCompleted) {
          checkpointGraphics.circle(0, -circleRadius * 0.35, circleRadius * 0.4);
          checkpointGraphics.fill({ color: 0xffffff, alpha: 0.3 });
        }

        checkpoint.addChild(checkpointGraphics);

        // Checkpoint number or checkmark
        const labelStyle = new TextStyle({
          fontSize: isCompleted ? 20 : 18,
          fill: isCompleted ? '#ffffff' : '#ffffff',
          fontFamily: 'Arial, sans-serif',
          fontWeight: 'bold',
          dropShadow: true,
        });
        // Set drop shadow properties directly (Pixi.js v8 API)
        (labelStyle as any).dropShadowColor = 0x000000;
        (labelStyle as any).dropShadowBlur = 2;
        (labelStyle as any).dropShadowAngle = Math.PI / 4;
        (labelStyle as any).dropShadowDistance = 1.5;
        
        const label = new Text({
          text: isCompleted ? '✓' : `${index + 1}`,
          style: labelStyle,
        });
        label.anchor.set(0.5);
        label.position.set(0, 0);
        checkpoint.addChild(label);

        // Checkpoint title (Clash of Clans style)
        const checkpointItem = checklistItems[index];
        if (checkpointItem && checkpointItem.title) {
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
          
          // Truncate long titles
          let titleText = checkpointItem.title;
          if (titleText.length > 20) {
            titleText = titleText.substring(0, 17) + '...';
          }
          
          const title = new Text({
            text: titleText,
            style: titleStyle,
          });
          title.anchor.set(0.5);
          title.position.set(0, circleRadius + 16);
          checkpoint.addChild(title);
        }

        // No stars - cleaner design like Clash of Clans

        pathContainer.addChild(checkpoint);
        
        // Store reference to current checkpoint for animation
        if (isCurrent && !isLocked && currentGlowContainer) {
          (checkpoint as any)._isCurrent = true;
          (checkpoint as any)._glowContainer = currentGlowContainer;
        }
      });

      app.stage.addChild(pathContainer);
      app.stage.addChild(decorFront);

      // Player character - detailed animated character
      const player = new Container();

      // Shadow with blur effect
      const playerShadow = new Graphics();
      playerShadow.ellipse(0, 0, 14, 7);
      playerShadow.fill({ color: 0x000000, alpha: 0.35 });
      playerShadow.ellipse(0, 0, 12, 6);
      playerShadow.fill({ color: 0x000000, alpha: 0.2 });
      playerShadow.position.set(0, 22);
      player.addChild(playerShadow);

      // Legs
      const leftLeg = new Graphics();
      leftLeg.roundRect(-6, 8, 5, 12, 2);
      leftLeg.fill(0x2563eb);
      leftLeg.roundRect(-5.5, 8, 4, 3, 1.5);
      leftLeg.fill({ color: 0x1e40af, alpha: 0.6 });
      player.addChild(leftLeg);

      const rightLeg = new Graphics();
      rightLeg.roundRect(1, 8, 5, 12, 2);
      rightLeg.fill(0x2563eb);
      rightLeg.roundRect(1.5, 8, 4, 3, 1.5);
      rightLeg.fill({ color: 0x1e40af, alpha: 0.6 });
      player.addChild(rightLeg);

      // Feet
      const leftFoot = new Graphics();
      leftFoot.roundRect(-7, 19, 6, 3, 1);
      leftFoot.fill(0x1e293b);
      player.addChild(leftFoot);

      const rightFoot = new Graphics();
      rightFoot.roundRect(1, 19, 6, 3, 1);
      rightFoot.fill(0x1e293b);
      player.addChild(rightFoot);

      // Torso/body with shirt
      const torso = new Graphics();
      torso.roundRect(-9, -4, 18, 20, 8);
      torso.fill(0x3b82f6);
      // Shirt detail
      torso.roundRect(-7, -2, 14, 6, 3);
      torso.fill({ color: 0x2563eb, alpha: 0.8 });
      // Belt
      torso.roundRect(-8, 8, 16, 3, 1);
      torso.fill(0x1e293b);
      player.addChild(torso);

      // Arms
      const leftArm = new Graphics();
      leftArm.roundRect(-12, 0, 5, 14, 3);
      leftArm.fill(0xfec89a);
      leftArm.roundRect(-11.5, 0, 4, 4, 2);
      leftArm.fill({ color: 0xfdb68a, alpha: 0.7 });
      player.addChild(leftArm);

      const rightArm = new Graphics();
      rightArm.roundRect(7, 0, 5, 14, 3);
      rightArm.fill(0xfec89a);
      rightArm.roundRect(7.5, 0, 4, 4, 2);
      rightArm.fill({ color: 0xfdb68a, alpha: 0.7 });
      player.addChild(rightArm);

      // Hands
      const leftHand = new Graphics();
      leftHand.circle(-9.5, 13, 3.5);
      leftHand.fill(0xfec89a);
      player.addChild(leftHand);

      const rightHand = new Graphics();
      rightHand.circle(9.5, 13, 3.5);
      rightHand.fill(0xfec89a);
      player.addChild(rightHand);

      // Head
      const head = new Graphics();
      head.circle(0, -18, 10);
      head.fill(0xfec89a);
      // Face shading
      head.circle(0, -16, 8);
      head.fill({ color: 0xfdb68a, alpha: 0.3 });
      player.addChild(head);

      // Eyes
      const leftEye = new Graphics();
      leftEye.circle(-3, -19, 1.8);
      leftEye.fill(0x1f2937);
      leftEye.circle(-2.8, -19.3, 0.6);
      leftEye.fill(0xffffff);
      player.addChild(leftEye);

      const rightEye = new Graphics();
      rightEye.circle(3, -19, 1.8);
      rightEye.fill(0x1f2937);
      rightEye.circle(2.8, -19.3, 0.6);
      rightEye.fill(0xffffff);
      player.addChild(rightEye);

      // Nose
      const nose = new Graphics();
      nose.ellipse(0, -16, 1, 1.5);
      nose.fill({ color: 0xfdb68a, alpha: 0.5 });
      player.addChild(nose);

      // Mouth
      const mouth = new Graphics();
      mouth.ellipse(0, -13.5, 2.5, 1.2);
      mouth.fill({ color: 0xef4444, alpha: 0.6 });
      player.addChild(mouth);

      // Hair
      const hair = new Graphics();
      hair.ellipse(0, -24, 9, 4.5);
      hair.fill(0x1e293b);
      hair.ellipse(-3, -25, 4, 3);
      hair.fill(0x1e293b);
      hair.ellipse(3, -25, 4, 3);
      hair.fill(0x1e293b);
      player.addChild(hair);

      // Backpack
      const backpack = new Graphics();
      backpack.roundRect(-10, -2, 7, 12, 3);
      backpack.fill(0x4f46e5);
      backpack.roundRect(-9, -1, 5, 4, 2);
      backpack.fill({ color: 0x6366f1, alpha: 0.8 });
      backpack.roundRect(-8.5, 6, 4, 2, 1);
      backpack.fill(0x1e293b);
      player.addChild(backpack);

      // Badge/emblem on chest
      const badge = new Graphics();
      badge.circle(0, 2, 4);
      badge.fill(0xffd700);
      badge.circle(0, 2, 3);
      badge.fill(0xffed4e);
      player.addChild(badge);

      const badgeIcon = new Text({
        text: dynamicSpec?.character?.skin?.includes('medic') ? '⚕' : '⭐',
        style: new TextStyle({
          fontSize: 8,
          fontFamily: 'Arial',
        }),
      });
      badgeIcon.anchor.set(0.5);
      badgeIcon.position.set(0, 2);
      player.addChild(badgeIcon);

      app.stage.addChild(player);

      // Doctor consultant character (always on right middle)
      const doctor = new Container();
      const doctorX = width * 0.85;
      const doctorY = height * 0.5;
      doctor.eventMode = 'static';
      doctor.cursor = 'pointer';
      doctor.on('pointertap', () => {
        // Will be handled by parent component
        (window as any).__openDoctorChat?.();
      });

      // Doctor shadow
      const doctorShadow = new Graphics();
      doctorShadow.ellipse(0, 0, 16, 8);
      doctorShadow.fill({ color: 0x000000, alpha: 0.3 });
      doctorShadow.position.set(0, 28);
      doctor.addChild(doctorShadow);

      // Doctor body (white coat)
      const doctorBody = new Graphics();
      doctorBody.roundRect(-12, -8, 24, 28, 6);
      doctorBody.fill(0xffffff);
      doctorBody.roundRect(-10, -6, 20, 6, 3);
      doctorBody.fill({ color: 0xf3f4f6, alpha: 0.8 });
      doctor.addChild(doctorBody);

      // Doctor legs
      const doctorLeftLeg = new Graphics();
      doctorLeftLeg.roundRect(-8, 18, 6, 10, 2);
      doctorLeftLeg.fill(0x1e293b);
      doctor.addChild(doctorLeftLeg);

      const doctorRightLeg = new Graphics();
      doctorRightLeg.roundRect(2, 18, 6, 10, 2);
      doctorRightLeg.fill(0x1e293b);
      doctor.addChild(doctorRightLeg);

      // Doctor arms
      const doctorLeftArm = new Graphics();
      doctorLeftArm.roundRect(-14, -4, 5, 16, 3);
      doctorLeftArm.fill(0xfec89a);
      doctor.addChild(doctorLeftArm);

      const doctorRightArm = new Graphics();
      doctorRightArm.roundRect(9, -4, 5, 16, 3);
      doctorRightArm.fill(0xfec89a);
      doctor.addChild(doctorRightArm);

      // Doctor head (wise old man)
      const doctorHead = new Graphics();
      doctorHead.circle(0, -22, 11);
      doctorHead.fill(0xfdb68a);
      doctor.addChild(doctorHead);

      // Beard
      const beard = new Graphics();
      beard.ellipse(0, -18, 8, 6);
      beard.fill(0xd1d5db);
      beard.ellipse(0, -16, 7, 5);
      beard.fill(0x9ca3af);
      doctor.addChild(beard);

      // Mustache
      const mustache = new Graphics();
      mustache.ellipse(-3, -20, 3, 2);
      mustache.fill(0xd1d5db);
      mustache.ellipse(3, -20, 3, 2);
      mustache.fill(0xd1d5db);
      doctor.addChild(mustache);

      // Glasses
      const leftGlass = new Graphics();
      leftGlass.circle(-4, -22, 3.5);
      leftGlass.stroke({ color: 0x1f2937, width: 1.5 });
      doctor.addChild(leftGlass);

      const rightGlass = new Graphics();
      rightGlass.circle(4, -22, 3.5);
      rightGlass.stroke({ color: 0x1f2937, width: 1.5 });
      doctor.addChild(rightGlass);

      const glassBridge = new Graphics();
      glassBridge.roundRect(-1.5, -22, 3, 1, 0.5);
      glassBridge.fill(0x1f2937);
      doctor.addChild(glassBridge);

      // Stethoscope
      const stethoscope = new Graphics();
      stethoscope.roundRect(-2, 4, 4, 12, 2);
      stethoscope.stroke({ color: 0x3b82f6, width: 2 });
      stethoscope.circle(0, 16, 3);
      stethoscope.stroke({ color: 0x3b82f6, width: 2 });
      doctor.addChild(stethoscope);

      // Doctor badge/name tag
      const doctorBadge = new Graphics();
      doctorBadge.roundRect(-6, -2, 12, 4, 1);
      doctorBadge.fill(0x3b82f6);
      doctor.addChild(doctorBadge);

      const doctorBadgeText = new Text({
        text: 'DR',
        style: new TextStyle({
          fontSize: 7,
          fill: '#ffffff',
          fontFamily: 'Arial',
          fontWeight: 'bold',
        }),
      });
      doctorBadgeText.anchor.set(0.5);
      doctorBadgeText.position.set(0, 0);
      doctor.addChild(doctorBadgeText);

      // Pulse indicator (subtle animation)
      const pulseIndicator = new Graphics();
      pulseIndicator.circle(0, 18, 2);
      pulseIndicator.fill({ color: 0xef4444, alpha: 0.8 });
      doctor.addChild(pulseIndicator);

      // Clickable indicator glow
      const clickableGlow = new Graphics();
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

      // Add doctor to a separate container so it's always on top
      const doctorContainer = new Container();
      doctorContainer.position.set(doctorX, doctorY);
      doctorContainer.addChild(doctor);
      doctorContainer.zIndex = 1000; // Ensure doctor is always visible
      app.stage.addChild(doctorContainer);

      const currentIdx = Math.max(0, Math.min(completed, nodePoints.length - 1));
      const currentNode = nodePoints[currentIdx] || nodePoints[0];
      let targetX = currentNode.x * width;
      let targetY = currentNode.y * height - 24;
      let x = targetX;
      let y = targetY;

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
        tick += 0.03;
        const liveCurrent = nodePoints[Math.max(0, Math.min(completed, nodePoints.length - 1))];
        targetX = (liveCurrent?.x || 0.1) * width;
        targetY = (liveCurrent?.y || 0.8) * height - 24;
        x += (targetX - x) * 0.11;
        y += (targetY - y) * 0.11;
        const bob = Math.sin(tick * 3.2) * 2.2;
        const breathe = Math.sin(tick * 2.1);
        const walk = Math.sin(tick * 4.5);
        
        // Player position and animation
        player.position.set(x, y + bob);
        player.rotation = Math.sin(tick * 1.2) * 0.02;
        
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
        
        // Doctor animation (subtle idle)
        const doctorBreathe = Math.sin(tick * 1.8);
        doctorContainer.position.y = doctorY + doctorBreathe * 1.5;
        doctor.rotation = Math.sin(tick * 0.8) * 0.01;
        
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


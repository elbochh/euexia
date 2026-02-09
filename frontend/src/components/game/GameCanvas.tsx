'use client';
import { useEffect, useRef, useCallback } from 'react';
import { Application, Graphics, Container, Text, TextStyle } from 'pixi.js';
import { getTheme, GameTheme } from './themes';

interface GameCanvasProps {
  theme: string;
  completedCount: number;
  totalCount: number;
  onCheckpointClick?: (index: number) => void;
}

export default function GameCanvas({
  theme,
  completedCount,
  totalCount,
  onCheckpointClick,
}: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);

  const drawMap = useCallback(
    (app: Application, themeData: GameTheme, completed: number, total: number) => {
      const { width, height } = app.screen;

      // Clear existing children
      while (app.stage.children.length > 0) {
        app.stage.removeChildAt(0);
      }

      // Background
      const bg = new Graphics();
      bg.rect(0, 0, width, height);
      bg.fill(themeData.skyColors[0]);
      app.stage.addChild(bg);

      // Ground gradient area (lower half)
      const ground = new Graphics();
      ground.rect(0, height * 0.4, width, height * 0.6);
      ground.fill(themeData.groundColor);
      app.stage.addChild(ground);

      // Draw decorative elements
      const elemContainer = new Container();
      themeData.elements.forEach((elem) => {
        const g = new Graphics();
        const ex = elem.x * width;
        const ey = elem.y * height;
        const s = elem.size;

        switch (elem.type) {
          case 'pyramid':
            g.moveTo(ex, ey + s);
            g.lineTo(ex + s, ey + s);
            g.lineTo(ex + s / 2, ey);
            g.closePath();
            g.fill(elem.color);
            // Add highlight
            g.moveTo(ex + s / 2, ey);
            g.lineTo(ex + s, ey + s);
            g.lineTo(ex + s / 2, ey + s);
            g.closePath();
            g.fill({ color: 0xffffff, alpha: 0.1 });
            break;
          case 'cactus':
            g.roundRect(ex - s / 6, ey - s, s / 3, s, 4);
            g.fill(elem.color);
            g.roundRect(ex - s / 2, ey - s * 0.7, s / 3, s * 0.4, 4);
            g.fill(elem.color);
            g.roundRect(ex + s / 6, ey - s * 0.8, s / 3, s * 0.5, 4);
            g.fill(elem.color);
            break;
          case 'sun':
            g.circle(ex, ey, s);
            g.fill({ color: elem.color, alpha: 0.3 });
            g.circle(ex, ey, s * 0.7);
            g.fill({ color: elem.color, alpha: 0.6 });
            g.circle(ex, ey, s * 0.4);
            g.fill(elem.color);
            break;
          case 'camel':
            g.ellipse(ex, ey, s, s * 0.5);
            g.fill(elem.color);
            g.circle(ex + s * 0.7, ey - s * 0.4, s * 0.3);
            g.fill(elem.color);
            break;
          case 'palm':
            g.roundRect(ex - 3, ey, 6, s, 3);
            g.fill(0x8b4513);
            g.ellipse(ex, ey - s * 0.1, s * 0.6, s * 0.3);
            g.fill(elem.color);
            break;
          case 'tree':
            g.roundRect(ex - 4, ey, 8, s * 0.6, 3);
            g.fill(0x5c4033);
            g.circle(ex, ey - s * 0.1, s * 0.4);
            g.fill(elem.color);
            g.circle(ex - s * 0.2, ey + s * 0.05, s * 0.3);
            g.fill({ color: elem.color, alpha: 0.85 });
            g.circle(ex + s * 0.2, ey + s * 0.05, s * 0.3);
            g.fill({ color: elem.color, alpha: 0.85 });
            break;
          case 'bush':
            g.circle(ex, ey, s * 0.5);
            g.fill(elem.color);
            g.circle(ex - s * 0.3, ey + 2, s * 0.4);
            g.fill({ color: elem.color, alpha: 0.9 });
            g.circle(ex + s * 0.3, ey + 2, s * 0.4);
            g.fill({ color: elem.color, alpha: 0.9 });
            break;
          case 'flower':
            for (let i = 0; i < 5; i++) {
              const angle = (i / 5) * Math.PI * 2;
              g.circle(
                ex + Math.cos(angle) * s * 0.4,
                ey + Math.sin(angle) * s * 0.4,
                s * 0.3
              );
              g.fill(elem.color);
            }
            g.circle(ex, ey, s * 0.25);
            g.fill(0xffff00);
            break;
          case 'monkey':
            g.circle(ex, ey, s * 0.5);
            g.fill(elem.color);
            g.circle(ex, ey - s * 0.2, s * 0.35);
            g.fill(0xa0522d);
            break;
          case 'parrot':
            g.ellipse(ex, ey, s * 0.3, s * 0.5);
            g.fill(elem.color);
            g.circle(ex, ey - s * 0.35, s * 0.25);
            g.fill(0xff6347);
            break;
          case 'waterfall':
            g.roundRect(ex - s / 3, ey, s * 0.66, s, 5);
            g.fill({ color: elem.color, alpha: 0.5 });
            break;
          case 'building':
            g.roundRect(ex - s * 0.15, ey, s * 0.3, s, 3);
            g.fill(elem.color);
            // Windows
            for (let row = 0; row < 6; row++) {
              for (let col = 0; col < 2; col++) {
                g.rect(
                  ex - s * 0.1 + col * s * 0.13,
                  ey + 10 + row * s * 0.14,
                  s * 0.08,
                  s * 0.08
                );
                g.fill({ color: 0xfbbf24, alpha: Math.random() > 0.3 ? 0.8 : 0.2 });
              }
            }
            break;
          case 'streetlight':
            g.roundRect(ex - 2, ey, 4, s, 2);
            g.fill(0x6b7280);
            g.circle(ex, ey, 6);
            g.fill({ color: elem.color, alpha: 0.8 });
            g.circle(ex, ey, 12);
            g.fill({ color: elem.color, alpha: 0.15 });
            break;
          case 'car':
            g.roundRect(ex - s, ey - s * 0.3, s * 2, s * 0.6, 5);
            g.fill(elem.color);
            g.roundRect(ex - s * 0.5, ey - s * 0.6, s, s * 0.4, 3);
            g.fill({ color: elem.color, alpha: 0.8 });
            break;
          case 'star':
            g.circle(ex, ey, s);
            g.fill({ color: elem.color, alpha: 0.7 });
            break;
        }
        elemContainer.addChild(g);
      });
      app.stage.addChild(elemContainer);

      // Draw path
      const pathContainer = new Container();
      const pathPoints = themeData.pathPoints.slice(0, Math.max(total, 2));
      const pathGraphics = new Graphics();

      // Draw dotted path line
      for (let i = 0; i < pathPoints.length - 1; i++) {
        const p1 = { x: pathPoints[i].x * width, y: pathPoints[i].y * height };
        const p2 = { x: pathPoints[i + 1].x * width, y: pathPoints[i + 1].y * height };

        pathGraphics.moveTo(p1.x, p1.y);
        pathGraphics.lineTo(p2.x, p2.y);
        pathGraphics.stroke({ color: themeData.pathColor, width: 8, alpha: 0.6 });

        // Inner lighter line
        pathGraphics.moveTo(p1.x, p1.y);
        pathGraphics.lineTo(p2.x, p2.y);
        pathGraphics.stroke({ color: 0xffffff, width: 2, alpha: 0.15 });
      }
      pathContainer.addChild(pathGraphics);

      // Draw checkpoints
      pathPoints.forEach((point, index) => {
        const cx = point.x * width;
        const cy = point.y * height;
        const isCompleted = index < completed;
        const isCurrent = index === completed;
        const isLocked = index > completed;

        const checkpoint = new Graphics();

        if (isCurrent) {
          // Glow for current
          checkpoint.circle(cx, cy, 22);
          checkpoint.fill({ color: themeData.checkpointGlow, alpha: 0.3 });
          checkpoint.circle(cx, cy, 18);
          checkpoint.fill({ color: themeData.checkpointGlow, alpha: 0.5 });
        }

        // Checkpoint circle
        checkpoint.circle(cx, cy, 14);
        if (isCompleted) {
          checkpoint.fill(themeData.checkpointColor);
        } else if (isCurrent) {
          checkpoint.fill(themeData.checkpointColor);
        } else {
          checkpoint.fill({ color: 0x6b7280, alpha: 0.6 });
        }

        // Border
        checkpoint.circle(cx, cy, 14);
        checkpoint.stroke({ color: isLocked ? 0x4b5563 : 0xffffff, width: 2, alpha: isLocked ? 0.4 : 0.8 });

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

        // Player character on current checkpoint
        if (isCurrent) {
          const player = new Graphics();
          player.circle(cx, cy - 28, 10);
          player.fill(0xff6b6b);
          player.circle(cx, cy - 28, 10);
          player.stroke({ color: 0xffffff, width: 2 });

          // Player hat (triangle)
          player.moveTo(cx - 7, cy - 38);
          player.lineTo(cx + 7, cy - 38);
          player.lineTo(cx, cy - 48);
          player.closePath();
          player.fill(0xff6b6b);

          pathContainer.addChild(player);
        }
      });

      app.stage.addChild(pathContainer);

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
      app.ticker.add(() => {
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
    []
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
      drawMap(app, themeData, completedCount, totalCount);
    };

    initApp();

    return () => {
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
    };
  }, [theme, completedCount, totalCount, drawMap]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-2xl overflow-hidden border-2 border-white/10"
      style={{ height: '55vh', minHeight: '350px' }}
    />
  );
}


export const jungleTheme = {
  name: 'Jungle Safari',
  emoji: '🌴',
  bgGradient: ['#14532d', '#166534', '#052e16'],
  groundColor: 0x2d5a2d,
  pathColor: 0x6b4c2a,
  skyColors: [0x87ceeb, 0x4ba3c3, 0x1a5c3a],

  elements: [
    { type: 'tree', x: 0.05, y: 0.3, size: 70, color: 0x228b22 },
    { type: 'tree', x: 0.85, y: 0.2, size: 80, color: 0x1a7a1a },
    { type: 'tree', x: 0.45, y: 0.15, size: 60, color: 0x2d8b2d },
    { type: 'tree', x: 0.95, y: 0.6, size: 55, color: 0x1a6b1a },
    { type: 'bush', x: 0.2, y: 0.7, size: 25, color: 0x3cb371 },
    { type: 'bush', x: 0.7, y: 0.8, size: 30, color: 0x2e8b57 },
    { type: 'bush', x: 0.15, y: 0.45, size: 20, color: 0x3cb371 },
    { type: 'flower', x: 0.3, y: 0.65, size: 12, color: 0xff69b4 },
    { type: 'flower', x: 0.6, y: 0.75, size: 10, color: 0xff1493 },
    { type: 'monkey', x: 0.12, y: 0.25, size: 20, color: 0x8b4513 },
    { type: 'parrot', x: 0.75, y: 0.15, size: 15, color: 0xff4500 },
    { type: 'waterfall', x: 0.5, y: 0.3, size: 40, color: 0x4169e1 },
  ],

  particles: {
    type: 'leaves',
    color: 0x32cd32,
    count: 20,
    speed: 0.2,
  },

  pathPoints: [
    { x: 0.1, y: 0.9 },
    { x: 0.3, y: 0.8 },
    { x: 0.2, y: 0.65 },
    { x: 0.4, y: 0.55 },
    { x: 0.6, y: 0.6 },
    { x: 0.75, y: 0.45 },
    { x: 0.55, y: 0.35 },
    { x: 0.35, y: 0.3 },
    { x: 0.5, y: 0.15 },
    { x: 0.7, y: 0.1 },
  ],

  checkpointColor: 0x32cd32,
  checkpointGlow: 0x00ff00,
};


export const cityTheme = {
  name: 'Modern City',
  emoji: '🏙️',
  bgGradient: ['#1e3a8a', '#1e40af', '#172554'],
  groundColor: 0x374151,
  pathColor: 0x4b5563,
  skyColors: [0x1e3a5f, 0x0a1628, 0x060d1a],

  elements: [
    { type: 'building', x: 0.05, y: 0.2, size: 120, color: 0x374151 },
    { type: 'building', x: 0.15, y: 0.25, size: 100, color: 0x4b5563 },
    { type: 'building', x: 0.85, y: 0.15, size: 130, color: 0x374151 },
    { type: 'building', x: 0.75, y: 0.2, size: 90, color: 0x4b5563 },
    { type: 'building', x: 0.45, y: 0.18, size: 110, color: 0x3b4252 },
    { type: 'streetlight', x: 0.25, y: 0.6, size: 35, color: 0xfbbf24 },
    { type: 'streetlight', x: 0.65, y: 0.5, size: 35, color: 0xfbbf24 },
    { type: 'car', x: 0.35, y: 0.7, size: 20, color: 0xef4444 },
    { type: 'car', x: 0.55, y: 0.8, size: 18, color: 0x3b82f6 },
    { type: 'star', x: 0.3, y: 0.05, size: 3, color: 0xffffff },
    { type: 'star', x: 0.5, y: 0.03, size: 2, color: 0xffffff },
    { type: 'star', x: 0.7, y: 0.06, size: 3, color: 0xffffff },
    { type: 'star', x: 0.2, y: 0.08, size: 2, color: 0xffffff },
    { type: 'star', x: 0.8, y: 0.04, size: 2, color: 0xffffff },
  ],

  particles: {
    type: 'lights',
    color: 0xfbbf24,
    count: 25,
    speed: 0.1,
  },

  pathPoints: [
    { x: 0.1, y: 0.9 },
    { x: 0.2, y: 0.75 },
    { x: 0.35, y: 0.8 },
    { x: 0.45, y: 0.65 },
    { x: 0.3, y: 0.5 },
    { x: 0.55, y: 0.45 },
    { x: 0.7, y: 0.55 },
    { x: 0.8, y: 0.35 },
    { x: 0.6, y: 0.25 },
    { x: 0.5, y: 0.12 },
  ],

  checkpointColor: 0x3b82f6,
  checkpointGlow: 0x60a5fa,
};


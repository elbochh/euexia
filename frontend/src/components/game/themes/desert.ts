export const desertTheme = {
  name: 'Desert Pyramids',
  emoji: '🏜️',
  bgGradient: ['#92400e', '#78350f', '#451a03'],
  groundColor: 0xd4a853,
  pathColor: 0xc2a04e,
  skyColors: [0xff9a3c, 0xff6b2b, 0x2d1b69],

  // Decorative elements to draw on the canvas
  elements: [
    { type: 'pyramid', x: 0.15, y: 0.25, size: 80, color: 0xc9a84c },
    { type: 'pyramid', x: 0.8, y: 0.2, size: 60, color: 0xb89a42 },
    { type: 'pyramid', x: 0.6, y: 0.15, size: 100, color: 0xd4a853 },
    { type: 'cactus', x: 0.1, y: 0.6, size: 30, color: 0x2d6a2d },
    { type: 'cactus', x: 0.9, y: 0.5, size: 25, color: 0x3a7a3a },
    { type: 'cactus', x: 0.4, y: 0.8, size: 20, color: 0x2d6a2d },
    { type: 'sun', x: 0.85, y: 0.08, size: 40, color: 0xffd700 },
    { type: 'camel', x: 0.3, y: 0.55, size: 25, color: 0xb8860b },
    { type: 'camel', x: 0.7, y: 0.65, size: 20, color: 0xa07808 },
    { type: 'palm', x: 0.5, y: 0.4, size: 35, color: 0x228b22 },
  ],

  // Animated sprites
  particles: {
    type: 'sand',
    color: 0xdaa520,
    count: 15,
    speed: 0.3,
  },

  // Path waypoints (normalized 0-1)
  pathPoints: [
    { x: 0.1, y: 0.9 },
    { x: 0.25, y: 0.75 },
    { x: 0.15, y: 0.6 },
    { x: 0.35, y: 0.5 },
    { x: 0.55, y: 0.55 },
    { x: 0.7, y: 0.4 },
    { x: 0.6, y: 0.25 },
    { x: 0.4, y: 0.2 },
    { x: 0.5, y: 0.1 },
    { x: 0.75, y: 0.12 },
  ],

  checkpointColor: 0xffd700,
  checkpointGlow: 0xff8c00,
};


export const GAME_CONFIG = {
  // XP & Leveling
  xpPerLevel: 100, // Level N requires N * 100 total XP
  maxLevel: 100,

  // Coins
  baseCoins: 5,
  baseXp: 10,

  // Streaks
  maxStreakMultiplier: 2.0,
  streakMultiplierStep: 0.1,

  // Themes
  themes: ['desert', 'jungle', 'city'] as const,
  themeSwitchInterval: 5, // tasks completed

  // Theme colors
  themeColors: {
    desert: {
      primary: '#f59e0b',
      secondary: '#d97706',
      bg: '#92400e',
      accent: '#fbbf24',
      name: 'Desert Pyramids',
      emoji: '🏜️',
    },
    jungle: {
      primary: '#22c55e',
      secondary: '#16a34a',
      bg: '#14532d',
      accent: '#4ade80',
      name: 'Jungle Safari',
      emoji: '🌴',
    },
    city: {
      primary: '#3b82f6',
      secondary: '#2563eb',
      bg: '#1e3a8a',
      accent: '#60a5fa',
      name: 'Modern City',
      emoji: '🏙️',
    },
  } as Record<string, {
    primary: string;
    secondary: string;
    bg: string;
    accent: string;
    name: string;
    emoji: string;
  }>,

  // Category icons
  categoryIcons: {
    medication: '💊',
    nutrition: '🥗',
    exercise: '🏃',
    monitoring: '📊',
    appointment: '📅',
    test: '🔬',
    lifestyle: '🌟',
    general: '✅',
  } as Record<string, string>,
};

export function getXpForLevel(level: number): number {
  return level * GAME_CONFIG.xpPerLevel;
}

export function getTotalXpForLevel(level: number): number {
  return (level * (level + 1)) / 2 * GAME_CONFIG.xpPerLevel - GAME_CONFIG.xpPerLevel;
}

export function getLevelProgress(xp: number, level: number): number {
  const currentLevelXp = getTotalXpForLevel(level);
  const nextLevelXp = getTotalXpForLevel(level + 1);
  return ((xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;
}


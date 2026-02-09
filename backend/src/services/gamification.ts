import { GameProgress, IGameProgress } from '../models/GameProgress';

const THEMES = ['desert', 'jungle', 'city'];
const THEME_SWITCH_INTERVAL = 5; // Switch theme every N completed tasks

/**
 * Calculate the XP needed for a given level
 */
export function xpForLevel(level: number): number {
  return level * 100;
}

/**
 * Calculate total XP needed to reach a level from level 1
 */
export function totalXpForLevel(level: number): number {
  return (level * (level + 1)) / 2 * 100 - 100;
}

/**
 * Get or create game progress for a user
 */
export async function getOrCreateProgress(userId: string): Promise<IGameProgress> {
  let progress = await GameProgress.findOne({ userId });
  if (!progress) {
    progress = await GameProgress.create({ userId });
  }
  return progress;
}

/**
 * Award XP and coins for completing a checklist item
 */
export async function awardCompletion(
  userId: string,
  baseXp: number,
  baseCoins: number
): Promise<{
  progress: IGameProgress;
  xpGained: number;
  coinsGained: number;
  leveledUp: boolean;
  newLevel: number;
  themeChanged: boolean;
  newTheme: string;
}> {
  const progress = await getOrCreateProgress(userId);

  // Calculate streak bonus
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lastActive = progress.lastActiveDate
    ? new Date(
        progress.lastActiveDate.getFullYear(),
        progress.lastActiveDate.getMonth(),
        progress.lastActiveDate.getDate()
      )
    : null;

  const dayDiff = lastActive
    ? Math.floor((today.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24))
    : -1;

  if (dayDiff === 1) {
    // Consecutive day
    progress.streak += 1;
  } else if (dayDiff > 1) {
    // Streak broken
    progress.streak = 1;
  } else if (dayDiff === -1) {
    // First time
    progress.streak = 1;
  }
  // dayDiff === 0 means same day, keep streak as is

  if (progress.streak > progress.longestStreak) {
    progress.longestStreak = progress.streak;
  }

  // Streak multiplier: 1x base, +10% per streak day (max 2x)
  const streakMultiplier = Math.min(2.0, 1.0 + progress.streak * 0.1);
  const xpGained = Math.round(baseXp * streakMultiplier);
  const coinsGained = Math.round(baseCoins * streakMultiplier);

  progress.xp += xpGained;
  progress.coins += coinsGained;
  progress.totalCompleted += 1;
  progress.lastActiveDate = now;

  // Check for level up
  const oldLevel = progress.level;
  while (progress.xp >= totalXpForLevel(progress.level + 1)) {
    progress.level += 1;
  }
  const leveledUp = progress.level > oldLevel;

  // Check for theme change
  let themeChanged = false;
  const themeIndex = Math.floor(progress.totalCompleted / THEME_SWITCH_INTERVAL) % THEMES.length;
  const newTheme = THEMES[themeIndex];
  if (newTheme !== progress.currentTheme) {
    if (!progress.completedThemes.includes(progress.currentTheme)) {
      progress.completedThemes.push(progress.currentTheme);
    }
    progress.currentTheme = newTheme;
    themeChanged = true;
  }

  await progress.save();

  return {
    progress,
    xpGained,
    coinsGained,
    leveledUp,
    newLevel: progress.level,
    themeChanged,
    newTheme: progress.currentTheme,
  };
}

/**
 * Get leaderboard (top players by XP)
 */
export async function getLeaderboard(limit: number = 20) {
  return GameProgress.find()
    .sort({ xp: -1 })
    .limit(limit)
    .populate('userId', 'name avatarUrl')
    .lean();
}


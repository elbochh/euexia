'use client';
import { create } from 'zustand';
import { authApi, gameApi, checklistApi } from '@/lib/api';

interface User {
  id: string;
  email: string;
  name: string;
}

interface GameProgress {
  _id: string;
  userId: string;
  xp: number;
  level: number;
  coins: number;
  currentTheme: string;
  completedThemes: string[];
  streak: number;
  longestStreak: number;
  totalCompleted: number;
  lastActiveDate: string | null;
}

interface ChecklistItem {
  _id: string;
  consultationId: string;
  userId: string;
  title: string;
  description: string;
  frequency: string;
  nextDueAt: string | null;
  isCompleted: boolean;
  completedAt: string | null;
  xpReward: number;
  coinReward: number;
  category: string;
  order: number;
}

interface RewardPopup {
  xpGained: number;
  coinsGained: number;
  leveledUp: boolean;
  newLevel: number;
  themeChanged: boolean;
  newTheme: string;
  totalXp: number;
  totalCoins: number;
  streak: number;
}

interface GameStore {
  // Auth
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;

  // Game
  progress: GameProgress | null;
  checklist: ChecklistItem[];
  rewardPopup: RewardPopup | null;
  isLoading: boolean;

  // Leaderboard
  leaderboard: any[];
  userRank: number;

  // Actions
  setUser: (user: User, token: string) => void;
  logout: () => void;
  loadProfile: () => Promise<void>;
  loadProgress: () => Promise<void>;
  loadChecklist: () => Promise<void>;
  completeItem: (itemId: string) => Promise<RewardPopup | null>;
  dismissReward: () => void;
  loadLeaderboard: () => Promise<void>;
  initFromStorage: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  // Initial state
  user: null,
  token: null,
  isAuthenticated: false,
  progress: null,
  checklist: [],
  rewardPopup: null,
  isLoading: false,
  leaderboard: [],
  userRank: 0,

  setUser: (user, token) => {
    localStorage.setItem('euexia_token', token);
    localStorage.setItem('euexia_user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('euexia_token');
    localStorage.removeItem('euexia_user');
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      progress: null,
      checklist: [],
    });
  },

  loadProfile: async () => {
    try {
      const res = await authApi.getMe();
      set({ user: res.data.user });
    } catch {
      get().logout();
    }
  },

  loadProgress: async () => {
    try {
      const res = await gameApi.getProgress();
      set({ progress: res.data.progress });
    } catch (error) {
      console.error('Failed to load progress:', error);
    }
  },

  loadChecklist: async () => {
    try {
      set({ isLoading: true });
      const res = await checklistApi.getAll();
      set({ checklist: res.data.items, isLoading: false });
    } catch (error) {
      console.error('Failed to load checklist:', error);
      set({ isLoading: false });
    }
  },

  completeItem: async (itemId) => {
    try {
      const res = await checklistApi.complete(itemId);
      const reward: RewardPopup = res.data.reward;

      // Update checklist item locally
      set((state) => ({
        checklist: state.checklist.map((item) =>
          item._id === itemId
            ? { ...item, isCompleted: true, completedAt: new Date().toISOString() }
            : item
        ),
        rewardPopup: reward,
        progress: state.progress
          ? {
              ...state.progress,
              xp: reward.totalXp,
              coins: reward.totalCoins,
              level: reward.newLevel,
              streak: reward.streak,
              currentTheme: reward.newTheme,
              totalCompleted: state.progress.totalCompleted + 1,
            }
          : state.progress,
      }));

      return reward;
    } catch (error) {
      console.error('Failed to complete item:', error);
      return null;
    }
  },

  dismissReward: () => set({ rewardPopup: null }),

  loadLeaderboard: async () => {
    try {
      const res = await gameApi.getLeaderboard(20);
      set({
        leaderboard: res.data.leaderboard,
        userRank: res.data.userRank,
      });
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    }
  },

  initFromStorage: () => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('euexia_token');
    const userStr = localStorage.getItem('euexia_user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        set({ user, token, isAuthenticated: true });
      } catch {
        // Invalid stored data
      }
    }
  },
}));


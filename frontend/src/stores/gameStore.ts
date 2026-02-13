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

interface MapSpecPoint {
  x: number;
  y: number;
}

interface MapSpecNode extends MapSpecPoint {
  id: string;
  index: number;
  stageType: string;
  label: string;
}

interface MapSpecDecor extends MapSpecPoint {
  assetId: string;
  scale: number;
  layer: 'back' | 'mid' | 'front';
}

export interface PersonalizedMapSpec {
  version: 1;
  themeId: 'desert_pyramids' | 'jungle_garden' | 'city_vitamins' | 'wellness_generic';
  styleTier: 'template' | 'enhanced' | 'ai_art';
  palette: {
    primary: string;
    secondary: string;
    accent: string;
    ground: string;
    sky: string;
  };
  background: {
    imageUrl?: string;
    parallaxLayers?: Array<{
      assetId: string;
      speed: number;
      opacity: number;
    }>;
  };
  path: MapSpecPoint[];
  nodes: MapSpecNode[];
  decor: MapSpecDecor[];
  character: { skin: string; x: number; y: number };
  meta: { source: 'ai' | 'fallback'; seed: number; checklistCount: number };
}

interface Consultation {
  _id: string;
  userId: string;
  title: string;
  status: string;
  createdAt: string;
  maps?: Array<{
    _id: string;
    mapIndex: number;
    startStepIndex: number;
    endStepIndex: number;
    mapSpec: PersonalizedMapSpec;
    source: 'ai' | 'fallback';
  }>;
  checklistItems?: ChecklistItem[];
  totalSteps?: number;
}

interface CurrentMapInfo {
  consultationId: string;
  consultationTitle: string;
  mapIndex: number;
  startStepIndex: number;
  endStepIndex: number;
  totalSteps: number;
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
  mapSpec: PersonalizedMapSpec | null;
  mapSpecSource: 'ai' | 'fallback' | null;
  mapValidationWarnings: string[];
  mapImageUrl: string | null;
  currentMapInfo: CurrentMapInfo | null;
  consultations: Consultation[];
  isLoading: boolean;

  // Leaderboard
  leaderboard: any[];
  userRank: number;

  // Actions
  setUser: (user: User, token: string) => void;
  logout: () => void;
  loadProfile: () => Promise<void>;
  loadProgress: () => Promise<void>;
  loadChecklist: (consultationId?: string) => Promise<void>;
  completeItem: (itemId: string) => Promise<RewardPopup | null>;
  dismissReward: () => void;
  loadLeaderboard: () => Promise<void>;
  loadMapSpec: () => Promise<void>;
  loadCurrentMap: () => Promise<void>;
  loadMap: (consultationId: string, mapIndex?: number) => Promise<void>;
  loadConsultationsWithMaps: () => Promise<void>;
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
  mapSpec: null,
  mapSpecSource: null,
  mapValidationWarnings: [],
  mapImageUrl: null,
  currentMapInfo: null,
  consultations: [],
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

  loadChecklist: async (consultationId?: string) => {
    try {
      set({ isLoading: true });
      let res;
      if (consultationId) {
        // Load items for specific consultation
        res = await checklistApi.getByConsultation(consultationId);
        console.log(`Loaded ${res.data.items?.length || 0} checklist items for consultation ${consultationId}`);
      } else {
        // Load all items for user
        res = await checklistApi.getAll();
        console.log(`Loaded ${res.data.items?.length || 0} checklist items for user`);
      }
      set({ checklist: res.data.items || [], isLoading: false });
    } catch (error) {
      console.error('Failed to load checklist:', error);
      set({ isLoading: false, checklist: [] });
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

  loadMapSpec: async () => {
    try {
      const res = await gameApi.getMapSpec();
      set({
        mapSpec: res.data.mapSpec,
        mapSpecSource: res.data.source || null,
        mapValidationWarnings: res.data.validation?.warnings || [],
      });
    } catch (error) {
      console.error('Failed to load map spec:', error);
    }
  },

  loadCurrentMap: async () => {
    try {
      const res = await gameApi.getCurrentMap();
      const consultationId = res.data.consultationId;
      set({
        mapSpec: res.data.mapSpec,
        mapSpecSource: res.data.source || null,
        mapValidationWarnings: res.data.validation?.warnings || [],
        mapImageUrl: res.data.mapImageUrl || null,
        currentMapInfo: {
          consultationId: consultationId,
          consultationTitle: res.data.consultationTitle || 'My Consultation',
          mapIndex: res.data.mapIndex || 0,
          startStepIndex: res.data.startStepIndex || 0,
          endStepIndex: res.data.endStepIndex || 0,
          totalSteps: res.data.totalSteps || 0,
        },
      });
      // Reload checklist items for this consultation to ensure we have the latest
      if (consultationId) {
        await get().loadChecklist(consultationId);
      }
    } catch (error) {
      console.error('Failed to load current map:', error);
    }
  },

  loadMap: async (consultationId: string, mapIndex: number = 0) => {
    try {
      const res = await gameApi.getMap(consultationId, mapIndex);
      set({
        mapSpec: res.data.mapSpec,
        mapSpecSource: res.data.source || null,
        mapValidationWarnings: res.data.validation?.warnings || [],
        mapImageUrl: res.data.mapImageUrl || null,
        currentMapInfo: {
          consultationId: res.data.consultationId,
          consultationTitle: '',
          mapIndex: res.data.mapIndex || 0,
          startStepIndex: res.data.startStepIndex || 0,
          endStepIndex: res.data.endStepIndex || 0,
          totalSteps: res.data.totalSteps || 0,
        },
      });
      // Reload checklist items for this consultation to ensure we have the latest
      await get().loadChecklist(consultationId);
    } catch (error) {
      console.error('Failed to load map:', error);
    }
  },

  loadConsultationsWithMaps: async () => {
    try {
      const res = await gameApi.getConsultationsWithMaps();
      set({ consultations: res.data.consultations || [] });
    } catch (error) {
      console.error('Failed to load consultations with maps:', error);
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


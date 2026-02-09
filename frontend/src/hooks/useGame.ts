'use client';
import { useEffect } from 'react';
import { useGameStore } from '@/stores/gameStore';

export function useGame() {
  const store = useGameStore();

  useEffect(() => {
    store.initFromStorage();
  }, []);

  useEffect(() => {
    if (store.isAuthenticated) {
      store.loadProgress();
      store.loadChecklist();
    }
  }, [store.isAuthenticated]);

  return store;
}

export function useAuth() {
  const { user, isAuthenticated, setUser, logout, initFromStorage } = useGameStore();

  useEffect(() => {
    initFromStorage();
  }, []);

  return { user, isAuthenticated, setUser, logout };
}


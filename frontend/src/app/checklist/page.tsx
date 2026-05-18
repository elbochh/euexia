'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import TopBar from '@/components/ui/TopBar';
import RewardPopup from '@/components/ui/RewardPopup';
import ChecklistView from '@/components/checklist/ChecklistView';
import { useGameStore } from '@/stores/gameStore';

export default function ChecklistPage() {
  const router = useRouter();
  const { isAuthenticated, initFromStorage, loadChecklist, loadProgress } = useGameStore();

  useEffect(() => {
    initFromStorage();
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('euexia_token')) {
      router.push('/');
      return;
    }
    if (isAuthenticated) {
      loadChecklist();
      loadProgress();
    }
  }, [isAuthenticated]);

  return (
    <div className="app-screen min-h-screen pb-24 pt-20">
      <TopBar />
      <RewardPopup />

      <div className="quest-shell px-3 mt-2">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel mb-4 px-4 py-5 text-center"
        >
          <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-2xl bg-emerald-400/15 text-3xl">
            ⚔️
          </div>
          <h2 className="section-title text-xl">Quest Board</h2>
          <p className="text-slate-400 text-xs">Complete quests to earn XP, coins, and streaks</p>
        </motion.div>

        <ChecklistView />
      </div>

    </div>
  );
}

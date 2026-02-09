'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import TopBar from '@/components/ui/TopBar';
import BottomNav from '@/components/ui/BottomNav';
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
    <div className="min-h-screen pb-20 pt-14">
      <TopBar />
      <RewardPopup />

      <div className="max-w-lg mx-auto px-3 mt-2">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-4"
        >
          <h2 className="text-xl font-bold">⚔️ Quest Board</h2>
          <p className="text-gray-500 text-xs">Complete quests to earn XP and coins</p>
        </motion.div>

        <ChecklistView />
      </div>

      <BottomNav />
    </div>
  );
}


'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import TopBar from '@/components/ui/TopBar';
import BottomNav from '@/components/ui/BottomNav';
import RewardPopup from '@/components/ui/RewardPopup';
import { useGameStore } from '@/stores/gameStore';
import { GAME_CONFIG } from '@/lib/gameConfig';

const GameCanvas = dynamic(() => import('@/components/game/GameCanvas'), { ssr: false });

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated, progress, checklist, initFromStorage, loadProgress, loadChecklist } =
    useGameStore();

  useEffect(() => {
    initFromStorage();
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('euexia_token');
      if (!token) {
        router.push('/');
        return;
      }
    }
    if (isAuthenticated) {
      loadProgress();
      loadChecklist();
    }
  }, [isAuthenticated]);

  const completedCount = checklist.filter((i) => i.isCompleted).length;
  const totalCount = checklist.length;
  const currentTheme = progress?.currentTheme || 'desert';
  const themeInfo = GAME_CONFIG.themeColors[currentTheme];

  const todayTasks = checklist.filter((i) => !i.isCompleted).slice(0, 3);

  return (
    <div className="min-h-screen pb-20 pt-14">
      <TopBar />
      <RewardPopup />

      <div className="max-w-lg mx-auto px-3">
        {/* Theme Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-3 mt-2"
        >
          <span className="text-2xl">{themeInfo?.emoji || '🗺️'}</span>
          <h2 className="text-lg font-bold" style={{ color: themeInfo?.accent }}>
            {themeInfo?.name || 'Desert Pyramids'}
          </h2>
          <p className="text-gray-500 text-xs">
            {completedCount}/{totalCount} quests completed
          </p>
        </motion.div>

        {/* Game Map */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <GameCanvas
            theme={currentTheme}
            completedCount={completedCount}
            totalCount={Math.max(totalCount, 5)}
          />
        </motion.div>

        {/* Today's Quests Quick View */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-4"
        >
          <div className="flex items-center justify-between mb-2 px-1">
            <h3 className="text-sm font-bold text-blue-300">⚔️ Today&apos;s Quests</h3>
            <button
              onClick={() => router.push('/checklist')}
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              View All →
            </button>
          </div>

          {todayTasks.length > 0 ? (
            todayTasks.map((task, i) => (
              <motion.div
                key={task._id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.1 }}
                className="game-card flex items-center gap-3 mb-2 cursor-pointer"
                onClick={() => router.push('/checklist')}
              >
                <span className="text-xl">
                  {GAME_CONFIG.categoryIcons[task.category] || '✅'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{task.title}</p>
                  <p className="text-xs text-gray-500 truncate">{task.description}</p>
                </div>
                <div className="text-xs text-purple-300">⚡{task.xpReward}</div>
              </motion.div>
            ))
          ) : (
            <div className="game-card text-center py-6">
              <div className="text-3xl mb-2">🎉</div>
              <p className="text-sm text-gray-400">All quests completed!</p>
              <button
                onClick={() => router.push('/upload')}
                className="btn-game mt-3 text-sm px-6 py-2"
              >
                Upload New Consultation
              </button>
            </div>
          )}
        </motion.div>

        {/* Stats Row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="grid grid-cols-3 gap-2 mt-4"
        >
          <div className="game-card text-center py-3">
            <div className="text-2xl mb-1">🔥</div>
            <div className="text-lg font-bold text-orange-300">{progress?.streak || 0}</div>
            <div className="text-[10px] text-gray-500">Day Streak</div>
          </div>
          <div className="game-card text-center py-3">
            <div className="text-2xl mb-1">⭐</div>
            <div className="text-lg font-bold text-yellow-300">{progress?.totalCompleted || 0}</div>
            <div className="text-[10px] text-gray-500">Completed</div>
          </div>
          <div className="game-card text-center py-3">
            <div className="text-2xl mb-1">🗺️</div>
            <div className="text-lg font-bold text-blue-300">
              {(progress?.completedThemes?.length || 0) + 1}
            </div>
            <div className="text-[10px] text-gray-500">Maps</div>
          </div>
        </motion.div>
      </div>

      <BottomNav />
    </div>
  );
}


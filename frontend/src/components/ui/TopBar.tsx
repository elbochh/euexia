'use client';
import { motion } from 'framer-motion';
import { useGameStore } from '@/stores/gameStore';
import { getLevelProgress } from '@/lib/gameConfig';

export default function TopBar() {
  const { progress, user } = useGameStore();

  const levelPct = progress ? getLevelProgress(progress.xp, progress.level) : 0;

  return (
    <motion.div
      initial={{ y: -60 }}
      animate={{ y: 0 }}
      className="fixed top-0 left-0 right-0 z-50 px-3 pt-2 pb-1"
      style={{
        background: 'linear-gradient(180deg, rgba(22,33,62,0.98) 0%, rgba(22,33,62,0.85) 100%)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div className="max-w-lg mx-auto flex items-center gap-2">
        {/* Level Badge */}
        <div className="level-badge text-xs flex-shrink-0">
          {progress?.level || 1}
        </div>

        {/* XP Bar */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between text-[10px] mb-0.5">
            <span className="text-purple-300 font-semibold truncate">
              {user?.name || 'Player'}
            </span>
            <span className="text-purple-300">
              {progress?.xp || 0} XP
            </span>
          </div>
          <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden border border-purple-900/50">
            <motion.div
              className="h-full rounded-full"
              style={{
                background: 'linear-gradient(90deg, #7c3aed, #a78bfa)',
              }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(levelPct, 100)}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Coins */}
        <div className="coin-badge text-xs flex-shrink-0">
          <span className="text-base">🪙</span>
          {progress?.coins || 0}
        </div>

        {/* Streak */}
        {(progress?.streak || 0) > 0 && (
          <div className="flex items-center gap-0.5 px-2 py-1 rounded-full bg-orange-500/20 border border-orange-500/30 flex-shrink-0">
            <span className="text-base">🔥</span>
            <span className="text-orange-300 text-xs font-bold">{progress?.streak}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}


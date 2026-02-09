'use client';
import { useGameStore } from '@/stores/gameStore';
import ChecklistItem from './ChecklistItem';
import { motion } from 'framer-motion';

export default function ChecklistView() {
  const { checklist, completeItem, isLoading } = useGameStore();

  const pending = checklist.filter((i) => !i.isCompleted);
  const completed = checklist.filter((i) => i.isCompleted);
  const progress = checklist.length > 0
    ? Math.round((completed.length / checklist.length) * 100)
    : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="text-4xl"
        >
          ⚡
        </motion.div>
      </div>
    );
  }

  if (checklist.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">📋</div>
        <h3 className="text-xl font-bold mb-2">No Tasks Yet</h3>
        <p className="text-gray-400 text-sm">
          Upload your consultation data to get your personalized health checklist!
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Progress Bar */}
      <div className="game-card mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold">Quest Progress</span>
          <span className="text-sm text-blue-300">
            {completed.length}/{checklist.length}
          </span>
        </div>
        <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: 'linear-gradient(90deg, #4ade80, #22c55e)',
            }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8 }}
          />
        </div>
        <div className="text-center mt-1 text-xs text-gray-500">{progress}% Complete</div>
      </div>

      {/* Pending Items */}
      {pending.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-bold text-blue-300 mb-3 px-1">
            ⚔️ Active Quests ({pending.length})
          </h3>
          {pending.map((item, i) => (
            <ChecklistItem
              key={item._id}
              item={item}
              index={i}
              onComplete={completeItem}
            />
          ))}
        </div>
      )}

      {/* Completed Items */}
      {completed.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-green-300 mb-3 px-1">
            ✨ Completed ({completed.length})
          </h3>
          {completed.map((item, i) => (
            <ChecklistItem
              key={item._id}
              item={item}
              index={i}
              onComplete={completeItem}
            />
          ))}
        </div>
      )}
    </div>
  );
}


'use client';
import { motion } from 'framer-motion';
import { GAME_CONFIG } from '@/lib/gameConfig';

interface ChecklistItemProps {
  item: {
    _id: string;
    title: string;
    description: string;
    frequency: string;
    isCompleted: boolean;
    xpReward: number;
    coinReward: number;
    category: string;
    order: number;
  };
  index: number;
  onComplete: (id: string) => void;
}

export default function ChecklistItem({ item, index, onComplete }: ChecklistItemProps) {
  const categoryIcon = GAME_CONFIG.categoryIcons[item.category] || '✅';

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08 }}
      className={`game-card flex items-start gap-3 mb-3 ${
        item.isCompleted ? 'opacity-60' : ''
      }`}
    >
      {/* Complete Button */}
      <button
        onClick={() => !item.isCompleted && onComplete(item._id)}
        disabled={item.isCompleted}
        className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center
          border-2 transition-all transform active:scale-90
          ${
            item.isCompleted
              ? 'bg-green-500/20 border-green-500/50'
              : 'bg-game-bg border-blue-500/30 hover:border-blue-500/60 hover:bg-blue-500/10'
          }`}
      >
        {item.isCompleted ? (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="text-green-400 text-lg"
          >
            ✓
          </motion.span>
        ) : (
          <span className="text-gray-600 text-sm">{index + 1}</span>
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">{categoryIcon}</span>
          <h4
            className={`font-semibold text-sm ${
              item.isCompleted ? 'line-through text-gray-500' : 'text-white'
            }`}
          >
            {item.title}
          </h4>
        </div>
        <p className="text-gray-400 text-xs leading-relaxed mb-2">
          {item.description}
        </p>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-purple-300">⚡ {item.xpReward} XP</span>
          <span className="text-yellow-300">🪙 {item.coinReward}</span>
          {item.frequency !== 'once' && (
            <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/20">
              {item.frequency}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}


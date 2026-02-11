'use client';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { GAME_CONFIG } from '@/lib/gameConfig';

interface ChecklistItem {
  _id: string;
  title: string;
  description: string;
  frequency: string;
  isCompleted: boolean;
  xpReward: number;
  coinReward: number;
  category: string;
  order: number;
}

interface CheckpointModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ChecklistItem | null;
  checkpointNumber: number;
  onComplete: (itemId: string) => void;
}

export default function CheckpointModal({
  isOpen,
  onClose,
  item,
  checkpointNumber,
  onComplete,
}: CheckpointModalProps) {
  if (!isOpen || !item) return null;

  const categoryIcon = GAME_CONFIG.categoryIcons[item.category] || '✅';

  const handleComplete = () => {
    if (!item.isCompleted) {
      onComplete(item._id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="game-card max-w-md w-full relative"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-700/50 transition-colors"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">{categoryIcon}</div>
          <div className="text-sm text-gray-400 mb-1">Checkpoint {checkpointNumber}</div>
          <h3 className="text-xl font-bold text-white">{item.title}</h3>
        </div>

        {/* Description */}
        {item.description && (
          <div className="mb-6">
            <p className="text-gray-300 text-sm leading-relaxed">{item.description}</p>
          </div>
        )}

        {/* Details */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="text-center">
            <div className="text-purple-300 text-lg font-bold">⚡ {item.xpReward}</div>
            <div className="text-gray-500 text-xs">XP</div>
          </div>
          <div className="text-center">
            <div className="text-yellow-300 text-lg font-bold">🪙 {item.coinReward}</div>
            <div className="text-gray-500 text-xs">Coins</div>
          </div>
          {item.frequency !== 'once' && (
            <div className="text-center">
              <div className="px-3 py-1 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/20 text-xs">
                {item.frequency}
              </div>
            </div>
          )}
        </div>

        {/* Status */}
        {item.isCompleted ? (
          <div className="text-center py-4">
            <div className="text-green-400 text-lg font-semibold mb-2">✓ Completed</div>
            <p className="text-gray-400 text-sm">This task has been completed!</p>
          </div>
        ) : (
          <button
            onClick={handleComplete}
            className="w-full btn-game py-3 text-base font-semibold"
          >
            Mark as Complete
          </button>
        )}
      </motion.div>
    </div>
  );
}


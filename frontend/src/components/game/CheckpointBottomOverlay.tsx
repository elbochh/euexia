'use client';
import { motion, AnimatePresence } from 'framer-motion';
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

interface CheckpointBottomOverlayProps {
  isOpen: boolean;
  item: ChecklistItem | null;
  checkpointNumber: number;
  onComplete: (itemId: string) => void;
  onClose: () => void;
}

export default function CheckpointBottomOverlay({
  isOpen,
  item,
  checkpointNumber,
  onComplete,
  onClose,
}: CheckpointBottomOverlayProps) {
  if (!item) return null;

  const categoryIcon = GAME_CONFIG.categoryIcons[item.category] || '✅';

  const handleComplete = () => {
    if (!item.isCompleted) {
      onComplete(item._id);
      // Close after a brief delay to show completion
      setTimeout(() => {
        onClose();
      }, 500);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Gradient overlay - strong at bottom, fades upward */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 pointer-events-none"
            style={{
              background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.6) 30%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0) 100%)',
            }}
          />

          {/* Bottom panel */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 z-50 pointer-events-auto"
          >
            <div className="bg-gradient-to-t from-gray-900 via-gray-800 to-gray-900 border-t-2 border-white/10 rounded-t-3xl shadow-2xl">
              {/* Handle bar */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-12 h-1 bg-white/30 rounded-full" />
              </div>

              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors"
              >
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Content */}
              <div className="px-6 pb-6 pt-2">
                {/* Header */}
                <div className="text-center mb-4">
                  <div className="text-5xl mb-2">{categoryIcon}</div>
                  <div className="text-sm text-gray-400 mb-1">Checkpoint {checkpointNumber}</div>
                  <h3 className="text-2xl font-bold text-white">{item.title}</h3>
                </div>

                {/* Description */}
                {item.description && (
                  <div className="mb-5">
                    <p className="text-gray-300 text-base leading-relaxed text-center">
                      {item.description}
                    </p>
                  </div>
                )}

                {/* Details */}
                <div className="flex items-center justify-center gap-6 mb-5">
                  <div className="text-center">
                    <div className="text-purple-300 text-xl font-bold">⚡ {item.xpReward}</div>
                    <div className="text-gray-500 text-xs">XP</div>
                  </div>
                  <div className="text-center">
                    <div className="text-yellow-300 text-xl font-bold">🪙 {item.coinReward}</div>
                    <div className="text-gray-500 text-xs">Coins</div>
                  </div>
                  {item.frequency !== 'once' && (
                    <div className="text-center">
                      <div className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs">
                        {item.frequency}
                      </div>
                    </div>
                  )}
                </div>

                {/* Status */}
                {item.isCompleted ? (
                  <div className="text-center py-3">
                    <div className="text-green-400 text-lg font-semibold mb-2">✓ Completed</div>
                    <p className="text-gray-400 text-sm">This task has been completed!</p>
                  </div>
                ) : (
                  <button
                    onClick={handleComplete}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold py-4 rounded-xl shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Mark as Complete
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}


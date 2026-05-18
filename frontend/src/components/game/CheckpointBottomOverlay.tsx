'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { GAME_CONFIG } from '@/lib/gameConfig';

interface ChecklistItem {
  _id: string;
  title: string;
  description: string;
  frequency: string;
  isCompleted: boolean;
  isLocked?: boolean;
  isAvailable?: boolean;
  remainingSeconds?: number;
  unlockAt?: string | null;
  xpReward: number;
  coinReward: number;
  category: string;
  order: number;
}

interface CheckpointBottomOverlayProps {
  isOpen: boolean;
  items: ChecklistItem[];
  checkpointNumber: number;
  onComplete: (itemId: string) => void;
  onClose: () => void;
  completingItemIds?: Set<string>;
}

function formatTimeRemaining(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}

export default function CheckpointBottomOverlay({
  isOpen,
  items,
  checkpointNumber,
  onComplete,
  onClose,
  completingItemIds,
}: CheckpointBottomOverlayProps) {
  if (!items || items.length === 0) return null;

  const categoryIcon = GAME_CONFIG.categoryIcons[items[0]?.category] || '✅';

  const handleComplete = (itemId: string) => {
    onComplete(itemId);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] pointer-events-none"
            style={{
              background: 'linear-gradient(to top, rgba(11,31,88,0.42) 0%, rgba(20,102,200,0.22) 42%, rgba(0,167,165,0.08) 70%, rgba(0,0,0,0) 100%)',
            }}
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 z-[80] pointer-events-auto max-h-[88vh] overflow-hidden flex flex-col"
          >
            <div className="bg-gradient-to-t from-white via-sky-50 to-white border-t-2 border-blue-100 rounded-t-3xl shadow-2xl shadow-blue-900/15 flex flex-col max-h-[88vh]">
              <div className="flex justify-center pt-3 pb-2 shrink-0">
                <div className="w-12 h-1 bg-blue-200 rounded-full" />
              </div>

              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full text-[#0b1f58] hover:bg-cyan-50 transition-colors z-10"
              >
                <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <div className="px-6 pb-28 pt-2 overflow-y-auto flex-1 min-h-0 overscroll-contain">
                <div className="text-center mb-4">
                  <div className="text-5xl mb-2">{categoryIcon}</div>
                  <div className="text-sm text-slate-500 mb-1">Day {checkpointNumber}</div>
                  <h3 className="text-xl font-bold text-[#0b1f58]">
                    {items.length === 1 ? items[0].title : `${items.length} tasks at this checkpoint`}
                  </h3>
                </div>

                <div className="space-y-4">
                  {items.map((item) => {
                    const isCompleting = completingItemIds?.has(item._id) ?? false;
                    return (
                    <div
                      key={item._id}
                      className="rounded-xl bg-white/85 border border-blue-100 p-4 shadow-lg shadow-blue-900/5"
                    >
                      <div className="font-semibold text-[#0b1f58]">{item.title}</div>
                      {item.description && (
                        <p className="text-slate-500 text-sm mt-1 line-clamp-2">{item.description}</p>
                      )}
                      <div className="flex items-center justify-between mt-3 gap-2">
                        <div className="flex items-center gap-3 text-sm text-slate-500">
                          <span>⚡ {item.xpReward} XP</span>
                          <span>🪙 {item.coinReward}</span>
                        </div>
                        {item.isCompleted ? (
                          <div className="text-teal-600 text-sm font-medium">✓ Completed</div>
                        ) : item.isLocked ? (
                          <div className="text-amber-600 text-sm">
                            {item.remainingSeconds != null && item.remainingSeconds > 0
                              ? `Unlocks in ${formatTimeRemaining(item.remainingSeconds)}`
                              : 'Complete previous task first'}
                          </div>
                        ) : (
                          <button
                            onClick={() => handleComplete(item._id)}
                            disabled={isCompleting}
                            className="px-4 py-2 rounded-lg bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-400 hover:to-blue-500 text-white text-sm font-semibold shadow-lg shadow-cyan-500/20 disabled:cursor-wait disabled:opacity-70"
                          >
                            {isCompleting ? 'Saving...' : 'Mark as Complete'}
                          </button>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

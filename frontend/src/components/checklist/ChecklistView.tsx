'use client';
import { useGameStore } from '@/stores/gameStore';
import ChecklistItem from './ChecklistItem';
import { motion } from 'framer-motion';

export default function ChecklistView() {
  const { checklist, completeItem, isLoading } = useGameStore();

  // Separate items into groups based on their timing state
  const available = checklist.filter(
    (i) => i.isAvailable && !i.isCompleted && !i.isFullyDone
  );
  const lockedOrCooldown = checklist.filter(
    (i) => (i.isLocked || i.isOnCooldown) && !i.isFullyDone
  );
  const completedThisCycle = checklist.filter(
    (i) => i.isCompleted && !i.isFullyDone && !i.isOnCooldown && !i.isLocked
  );
  const fullyDone = checklist.filter((i) => i.isFullyDone);
  const expired = checklist.filter((i) => i.isExpired && !i.isFullyDone);

  const totalDone = fullyDone.length + completedThisCycle.length;
  const progress =
    checklist.length > 0
      ? Math.round((totalDone / checklist.length) * 100)
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
            {totalDone}/{checklist.length}
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

      {/* Available Now */}
      {available.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-bold text-blue-300 mb-3 px-1">
            ⚔️ Available Now ({available.length})
          </h3>
          {available.map((item, i) => (
            <ChecklistItem
              key={item._id}
              item={item}
              index={i}
              onComplete={completeItem}
            />
          ))}
        </div>
      )}

      {/* Locked / On Cooldown */}
      {lockedOrCooldown.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-bold text-orange-300 mb-3 px-1">
            ⏳ Coming Up ({lockedOrCooldown.length})
          </h3>
          {lockedOrCooldown.map((item, i) => (
            <ChecklistItem
              key={item._id}
              item={item}
              index={i}
              onComplete={completeItem}
            />
          ))}
        </div>
      )}

      {/* Completed this cycle (recurring items that are done for now) */}
      {completedThisCycle.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-bold text-green-300 mb-3 px-1">
            ✅ Done for Now ({completedThisCycle.length})
          </h3>
          {completedThisCycle.map((item, i) => (
            <ChecklistItem
              key={item._id}
              item={item}
              index={i}
              onComplete={completeItem}
            />
          ))}
        </div>
      )}

      {/* Fully Completed */}
      {fullyDone.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-bold text-emerald-300 mb-3 px-1">
            ★ Fully Completed ({fullyDone.length})
          </h3>
          {fullyDone.map((item, i) => (
            <ChecklistItem
              key={item._id}
              item={item}
              index={i}
              onComplete={completeItem}
            />
          ))}
        </div>
      )}

      {/* Expired */}
      {expired.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-red-300 mb-3 px-1">
            ⛔ Expired ({expired.length})
          </h3>
          {expired.map((item, i) => (
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

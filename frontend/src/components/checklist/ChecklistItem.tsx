'use client';
import { useState, useEffect } from 'react';
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
    // Timing
    isLocked?: boolean;
    isOnCooldown?: boolean;
    isExpired?: boolean;
    isAvailable?: boolean;
    isFullyDone?: boolean;
    remainingSeconds?: number;
    completionProgress?: string | null;
    timeOfDay?: string;
    totalRequired?: number;
    completionCount?: number;
  };
  index: number;
  onComplete: (id: string) => void;
}

/** Format seconds into a human-readable countdown */
function formatCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return 'now';
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** Get a label for time of day */
function timeOfDayLabel(timeOfDay?: string): string | null {
  switch (timeOfDay) {
    case 'morning': return 'Morning';
    case 'afternoon': return 'Afternoon';
    case 'evening': return 'Evening';
    case 'night': return 'Night';
    default: return null;
  }
}

export default function ChecklistItem({ item, index, onComplete }: ChecklistItemProps) {
  const categoryIcon = GAME_CONFIG.categoryIcons[item.category] || '✅';

  const isLocked = item.isLocked ?? false;
  const isOnCooldown = item.isOnCooldown ?? false;
  const isExpired = item.isExpired ?? false;
  const isFullyDone = item.isFullyDone ?? false;
  const isAvailable = item.isAvailable ?? (!item.isCompleted && !isLocked && !isOnCooldown && !isExpired && !isFullyDone);

  // Live countdown timer
  const [countdown, setCountdown] = useState(item.remainingSeconds || 0);

  useEffect(() => {
    setCountdown(item.remainingSeconds || 0);
  }, [item.remainingSeconds]);

  useEffect(() => {
    if (countdown <= 0) return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [countdown > 0]);

  // Determine the visual state
  const isDisabled = !isAvailable;
  const showTimer = (isLocked || isOnCooldown) && countdown > 0;
  const todLabel = timeOfDayLabel(item.timeOfDay);

  // Card styling based on state
  let cardClass = 'game-card flex items-start gap-3 mb-3 relative overflow-hidden';
  if (isFullyDone) {
    cardClass += ' opacity-50';
  } else if (isExpired) {
    cardClass += ' opacity-40';
  } else if (isLocked || isOnCooldown) {
    cardClass += ' opacity-75';
  } else if (item.isCompleted && !isOnCooldown) {
    cardClass += ' opacity-60';
  }

  // Button styling based on state
  let buttonClass = 'flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all transform';
  if (isFullyDone) {
    buttonClass += ' bg-green-500/30 border-green-500/60';
  } else if (isLocked) {
    buttonClass += ' bg-gray-800 border-gray-600 cursor-not-allowed';
  } else if (isOnCooldown) {
    buttonClass += ' bg-orange-500/10 border-orange-500/30 cursor-not-allowed';
  } else if (item.isCompleted) {
    buttonClass += ' bg-green-500/20 border-green-500/50';
  } else {
    buttonClass += ' bg-game-bg border-blue-500/30 hover:border-blue-500/60 hover:bg-blue-500/10 active:scale-90';
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08 }}
      className={cardClass}
    >
      {/* Lock / Cooldown overlay stripe */}
      {(isLocked || isOnCooldown) && countdown > 0 && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500/60 via-yellow-500/60 to-orange-500/60" />
      )}

      {/* Complete / Status Button */}
      <button
        onClick={() => isAvailable && onComplete(item._id)}
        disabled={isDisabled}
        className={buttonClass}
      >
        {isFullyDone ? (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-green-400 text-lg">
            ★
          </motion.span>
        ) : isLocked ? (
          <span className="text-gray-500 text-sm">🔒</span>
        ) : isOnCooldown ? (
          <span className="text-orange-400 text-sm">⏳</span>
        ) : item.isCompleted ? (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-green-400 text-lg">
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
              isFullyDone
                ? 'line-through text-gray-500'
                : isLocked || isOnCooldown
                  ? 'text-gray-400'
                  : item.isCompleted
                    ? 'line-through text-gray-500'
                    : 'text-white'
            }`}
          >
            {item.title}
          </h4>
        </div>

        <p className="text-gray-400 text-xs leading-relaxed mb-2">
          {item.description}
        </p>

        {/* Timer banner */}
        {showTimer && (
          <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20">
            <span className="text-orange-400 text-xs">
              {isLocked ? '🔒' : '⏳'}
            </span>
            <span className="text-orange-300 text-xs font-medium">
              {isLocked ? 'Unlocks in ' : 'Next in '}
              <span className="font-bold">{formatCountdown(countdown)}</span>
            </span>
          </div>
        )}

        {/* Expired banner */}
        {isExpired && (
          <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
            <span className="text-red-400 text-xs">⛔</span>
            <span className="text-red-300 text-xs font-medium">Task expired</span>
          </div>
        )}

        {/* Bottom info row */}
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <span className="text-purple-300">⚡ {item.xpReward} XP</span>
          <span className="text-yellow-300">🪙 {item.coinReward}</span>

          {/* Progress badge for recurring items */}
          {item.completionProgress && (
            <span className="px-2 py-0.5 rounded-full bg-green-500/15 text-green-300 border border-green-500/20">
              {item.completionProgress}
            </span>
          )}

          {/* Frequency badge */}
          {item.frequency !== 'once' && (
            <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/20">
              {item.frequency}
            </span>
          )}

          {/* Time of day badge */}
          {todLabel && (
            <span className="px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/20">
              {todLabel === 'Morning' ? '🌅' : todLabel === 'Afternoon' ? '☀️' : todLabel === 'Evening' ? '🌆' : '🌙'} {todLabel}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

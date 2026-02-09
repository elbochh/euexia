'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/stores/gameStore';

export default function RewardPopup() {
  const { rewardPopup, dismissReward } = useGameStore();

  return (
    <AnimatePresence>
      {rewardPopup && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
          onClick={dismissReward}
        >
          <motion.div
            initial={{ scale: 0.3, opacity: 0, rotateZ: -10 }}
            animate={{ scale: 1, opacity: 1, rotateZ: 0 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="game-panel p-6 mx-4 max-w-sm w-full text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Level Up */}
            {rewardPopup.leveledUp && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2 }}
                className="mb-4"
              >
                <div className="text-5xl mb-2">⬆️</div>
                <h2 className="text-2xl font-bold text-yellow-300">LEVEL UP!</h2>
                <p className="text-yellow-100 text-lg">Level {rewardPopup.newLevel}</p>
              </motion.div>
            )}

            {/* Theme Change */}
            {rewardPopup.themeChanged && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3 }}
                className="mb-4 p-3 rounded-xl bg-green-500/10 border border-green-500/30"
              >
                <div className="text-3xl mb-1">🗺️</div>
                <p className="text-green-300 font-semibold">New Map Unlocked!</p>
                <p className="text-green-200 text-sm capitalize">{rewardPopup.newTheme}</p>
              </motion.div>
            )}

            {/* Rewards */}
            <div className="flex justify-center gap-6 mb-6">
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="text-center"
              >
                <motion.div
                  animate={{ rotateY: [0, 360] }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                  className="text-4xl mb-1"
                >
                  🪙
                </motion.div>
                <p className="text-yellow-300 font-bold text-xl">
                  +{rewardPopup.coinsGained}
                </p>
                <p className="text-yellow-100/60 text-xs">Coins</p>
              </motion.div>

              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-center"
              >
                <motion.div
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                  className="text-4xl mb-1"
                >
                  ⚡
                </motion.div>
                <p className="text-purple-300 font-bold text-xl">
                  +{rewardPopup.xpGained}
                </p>
                <p className="text-purple-100/60 text-xs">XP</p>
              </motion.div>
            </div>

            {!rewardPopup.leveledUp && !rewardPopup.themeChanged && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: 'spring' }}
                className="text-5xl mb-3"
              >
                🎉
              </motion.div>
            )}

            <h3 className="text-lg font-bold text-white mb-4">
              {rewardPopup.leveledUp ? 'Amazing!' : 'Quest Complete!'}
            </h3>

            <button
              onClick={dismissReward}
              className="btn-game w-full text-lg"
            >
              Continue
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}


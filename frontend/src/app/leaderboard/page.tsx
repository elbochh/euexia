'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import TopBar from '@/components/ui/TopBar';
import BottomNav from '@/components/ui/BottomNav';
import { useGameStore } from '@/stores/gameStore';

export default function LeaderboardPage() {
  const router = useRouter();
  const { isAuthenticated, initFromStorage, loadLeaderboard, leaderboard, userRank, user } =
    useGameStore();

  useEffect(() => {
    initFromStorage();
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('euexia_token')) {
      router.push('/');
      return;
    }
    if (isAuthenticated) {
      loadLeaderboard();
    }
  }, [isAuthenticated]);

  const medalEmojis = ['🥇', '🥈', '🥉'];

  return (
    <div className="min-h-screen pb-20 pt-14">
      <TopBar />

      <div className="max-w-lg mx-auto px-3 mt-2">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <div className="text-4xl mb-2">🏆</div>
          <h2 className="text-xl font-bold">Leaderboard</h2>
          {userRank > 0 && (
            <p className="text-blue-300 text-sm mt-1">
              Your rank: #{userRank}
            </p>
          )}
        </motion.div>

        {/* Top 3 Podium */}
        {leaderboard.length >= 3 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-end justify-center gap-3 mb-6"
          >
            {[1, 0, 2].map((podiumIndex) => {
              const player = leaderboard[podiumIndex];
              if (!player) return null;
              const isFirst = podiumIndex === 0;
              return (
                <div
                  key={podiumIndex}
                  className={`text-center ${isFirst ? 'order-2' : podiumIndex === 1 ? 'order-1' : 'order-3'}`}
                >
                  <div className="text-2xl mb-1">{medalEmojis[podiumIndex]}</div>
                  <div
                    className={`level-badge mx-auto mb-1 ${isFirst ? 'w-14 h-14 text-lg' : 'w-10 h-10 text-sm'}`}
                  >
                    {player.level || 1}
                  </div>
                  <p className="text-xs font-semibold truncate max-w-[80px]">
                    {player.userId?.name || 'Player'}
                  </p>
                  <p className="text-[10px] text-purple-300">{player.xp} XP</p>
                  <div
                    className={`game-card mt-1 ${
                      isFirst ? 'h-20' : podiumIndex === 1 ? 'h-14' : 'h-10'
                    }`}
                    style={{
                      background: isFirst
                        ? 'linear-gradient(180deg, #fbbf24, #d97706)'
                        : podiumIndex === 1
                          ? 'linear-gradient(180deg, #9ca3af, #6b7280)'
                          : 'linear-gradient(180deg, #b45309, #92400e)',
                    }}
                  />
                </div>
              );
            })}
          </motion.div>
        )}

        {/* Full List */}
        <div className="space-y-2">
          {leaderboard.map((player: any, index: number) => {
            const isCurrentUser = player.userId?._id === user?.id;
            return (
              <motion.div
                key={player._id || index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`game-card flex items-center gap-3 ${
                  isCurrentUser ? 'border-blue-500/50 bg-blue-500/10' : ''
                }`}
              >
                <div className="w-8 text-center font-bold text-sm">
                  {index < 3 ? medalEmojis[index] : `#${index + 1}`}
                </div>
                <div className="level-badge text-xs w-8 h-8">
                  {player.level || 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {player.userId?.name || 'Player'}
                    {isCurrentUser && (
                      <span className="text-blue-400 ml-1">(You)</span>
                    )}
                  </p>
                  <div className="flex gap-3 text-[10px]">
                    <span className="text-purple-300">⚡ {player.xp} XP</span>
                    <span className="text-yellow-300">🪙 {player.coins}</span>
                    {player.streak > 0 && (
                      <span className="text-orange-300">🔥 {player.streak}</span>
                    )}
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  {player.totalCompleted || 0} done
                </div>
              </motion.div>
            );
          })}

          {leaderboard.length === 0 && (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">🏆</div>
              <h3 className="text-lg font-bold mb-2">No Rankings Yet</h3>
              <p className="text-gray-400 text-sm">
                Complete quests to appear on the leaderboard!
              </p>
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}


'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { useGameStore } from '@/stores/gameStore';
import { getLevelProgress } from '@/lib/gameConfig';
import { DEFAULT_CHARACTER_ID, getCharacterSpriteSrc } from '@/lib/characters';

export default function TopBar() {
  const { progress, user } = useGameStore();

  const levelPct = progress ? getLevelProgress(progress.xp, progress.level) : 0;
  const characterId = (progress?.selectedCharacter as any) || DEFAULT_CHARACTER_ID;

  const handleProfileClick = () => {
    if (typeof window !== 'undefined' && (window as any).__openProfile) {
      (window as any).__openProfile();
    }
  };

  return (
    <motion.div
      initial={{ y: -60 }}
      animate={{ y: 0 }}
      className="fixed left-0 right-0 top-0 z-40 px-3 pb-1.5 pt-2"
    >
      <div className="quest-shell">
        <div className="relative overflow-hidden rounded-[1.4rem] border border-blue-200/70 bg-white/90 px-2.5 py-1.5 shadow-2xl shadow-blue-900/10 backdrop-blur-xl">
          <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
          <div className="flex items-center gap-2.5">
        {/* Level Badge */}
        <div className="relative flex-shrink-0">
          <div className="absolute inset-0 rounded-full bg-cyan-300/30 blur-md" />
          <div className="level-badge relative h-10 w-10 text-sm">
            {progress?.level || 1}
          </div>
        </div>

        {/* XP Bar */}
        <div className="flex-1 min-w-0">
          <div className="mb-1 flex items-center justify-between gap-2 text-[10px]">
            <span className="truncate font-bold uppercase tracking-wide text-[#0b1f58]">
              {user?.name || 'Player'}
            </span>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 font-bold text-blue-700">
              {progress?.xp || 0} XP
            </span>
          </div>
          <div className="relative h-2.5 overflow-hidden rounded-full border border-blue-100 bg-blue-50">
            <motion.div
              className="h-full rounded-full"
              style={{
                background: 'linear-gradient(90deg, #00a7a5, #4dd7e8, #1466c8)',
                boxShadow: '0 0 18px rgba(77,215,232,0.45)',
              }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(levelPct, 100)}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.22),transparent)] opacity-50" />
          </div>
        </div>

        {/* Coins */}
        <div className="coin-badge h-9 flex-shrink-0 px-3 text-xs">
          <span className="text-sm">🪙</span>
          {progress?.coins || 0}
        </div>

        {/* Streak */}
        {(progress?.streak || 0) > 0 && (
          <div className="flex items-center gap-0.5 px-2 py-1 rounded-full bg-orange-50 border border-orange-200 flex-shrink-0">
            <span className="text-base">🔥</span>
            <span className="text-orange-600 text-xs font-bold">{progress?.streak}</span>
          </div>
        )}

        {/* Profile avatar */}
        <button
          type="button"
          onClick={handleProfileClick}
          className="ml-1 w-8 h-8 rounded-[1rem] overflow-hidden border border-blue-100 bg-white flex-shrink-0 flex items-center justify-center shadow-sm hover:scale-[1.03] hover:border-cyan-400 transition"
        >
          <Image
            src={getCharacterSpriteSrc(characterId)}
            alt="Profile character"
            width={30}
            height={30}
            className="object-contain"
          />
        </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}


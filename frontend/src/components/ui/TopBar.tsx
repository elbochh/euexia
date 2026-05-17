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
        <div className="relative overflow-hidden rounded-[1.4rem] border border-white/10 bg-slate-950/72 px-2.5 py-1.5 shadow-2xl shadow-slate-950/40 backdrop-blur-xl">
          <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/60 to-transparent" />
          <div className="flex items-center gap-2.5">
        {/* Level Badge */}
        <div className="relative flex-shrink-0">
          <div className="absolute inset-0 rounded-full bg-orange-300/30 blur-md" />
          <div className="level-badge relative h-10 w-10 text-sm">
            {progress?.level || 1}
          </div>
        </div>

        {/* XP Bar */}
        <div className="flex-1 min-w-0">
          <div className="mb-1 flex items-center justify-between gap-2 text-[10px]">
            <span className="truncate font-bold uppercase tracking-wide text-cyan-100">
              {user?.name || 'Player'}
            </span>
            <span className="rounded-full bg-violet-400/15 px-2 py-0.5 font-bold text-violet-100">
              {progress?.xp || 0} XP
            </span>
          </div>
          <div className="relative h-2.5 overflow-hidden rounded-full border border-white/10 bg-slate-950/80">
            <motion.div
              className="h-full rounded-full"
              style={{
                background: 'linear-gradient(90deg, #22c55e, #38bdf8, #a78bfa)',
                boxShadow: '0 0 18px rgba(56,189,248,0.5)',
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
          <div className="flex items-center gap-0.5 px-2 py-1 rounded-full bg-orange-500/20 border border-orange-500/30 flex-shrink-0">
            <span className="text-base">🔥</span>
            <span className="text-orange-300 text-xs font-bold">{progress?.streak}</span>
          </div>
        )}

        {/* Profile avatar */}
        <button
          type="button"
          onClick={handleProfileClick}
          className="ml-1 w-8 h-8 rounded-[1rem] overflow-hidden border border-slate-400/60 bg-slate-900 flex-shrink-0 flex items-center justify-center hover:scale-[1.03] hover:border-blue-400 transition"
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



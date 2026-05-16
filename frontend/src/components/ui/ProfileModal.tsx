'use client';

import Image from 'next/image';
import { CHARACTERS, DEFAULT_CHARACTER_ID, getCharacterSpriteSrc } from '@/lib/characters';
import { useGameStore } from '@/stores/gameStore';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { user, progress, purchaseCharacter, selectCharacter } = useGameStore();

  if (!isOpen) return null;

  const coins = progress?.coins ?? 0;
  const owned = new Set(progress?.ownedCharacters ?? [DEFAULT_CHARACTER_ID]);
  const selected = progress?.selectedCharacter || DEFAULT_CHARACTER_ID;

  const handleBuy = async (id: string, ownedAlready: boolean, price: number) => {
    if (!progress) return;
    if (!ownedAlready && coins < price) return;
    if (ownedAlready) {
      await selectCharacter(id);
    } else {
      await purchaseCharacter(id);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="game-card max-w-md w-full mx-4 relative">
        <button
          className="absolute right-3 top-3 p-1.5 rounded-full hover:bg-gray-700/60"
          onClick={onClose}
        >
          <span className="sr-only">Close</span>
          <svg
            className="w-4 h-4 text-gray-300"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="relative w-14 h-14 rounded-2xl overflow-hidden border-2 border-blue-400 bg-slate-900 flex-shrink-0">
            <Image
              src={getCharacterSpriteSrc(selected as any)}
              alt="Selected character"
              fill
              className="object-contain p-1"
            />
          </div>
          <div className="flex-1">
            <p className="text-xs uppercase tracking-wide text-blue-300/80">Profile</p>
            <h2 className="text-lg font-bold text-white">{user?.name || 'Guest'}</h2>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-5 text-center text-xs">
          <div className="rounded-xl bg-slate-800/70 px-2 py-2 border border-slate-700/70">
            <p className="text-[11px] text-slate-300">Level</p>
            <p className="text-lg font-bold text-blue-300">{progress?.level ?? 1}</p>
          </div>
          <div className="rounded-xl bg-slate-800/70 px-2 py-2 border border-slate-700/70">
            <p className="text-[11px] text-slate-300">XP</p>
            <p className="text-lg font-bold text-purple-300">{progress?.xp ?? 0}</p>
          </div>
          <div className="rounded-xl bg-slate-800/70 px-2 py-2 border border-slate-700/70">
            <p className="text-[11px] text-slate-300">Coins</p>
            <p className="text-lg font-bold text-amber-300 flex items-center justify-center gap-1">
              <span>🪙</span>
              <span>{coins}</span>
            </p>
          </div>
        </div>

        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Characters</h3>
          <p className="text-[11px] text-gray-400">Unlock with coins, then equip</p>
        </div>

        <div className="grid grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
          {CHARACTERS.map((ch) => {
            const isOwned = owned.has(ch.id);
            const isSelected = selected === ch.id;
            const affordable = coins >= ch.price;

            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => handleBuy(ch.id, isOwned, ch.price)}
                disabled={!isOwned && !affordable}
                className={`relative flex flex-col items-center rounded-xl border px-2 pt-2 pb-2.5 text-xs transition-colors ${
                  isSelected
                    ? 'border-blue-400 bg-blue-500/20'
                    : isOwned
                    ? 'border-emerald-400/60 bg-emerald-500/10 hover:bg-emerald-500/20'
                    : affordable
                    ? 'border-slate-600 bg-slate-800/70 hover:bg-slate-700/80'
                    : 'border-slate-700 bg-slate-900/70 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="relative w-16 h-16 mb-1 rounded-lg overflow-hidden bg-slate-900 flex items-center justify-center">
                  <Image
                    src={getCharacterSpriteSrc(ch.id)}
                    alt={ch.name}
                    fill
                    className="object-contain p-1.5"
                  />
                </div>
                <div className="font-semibold text-slate-100 text-[11px] mb-0.5">{ch.name}</div>
                <div className="flex items-center justify-center gap-1 text-[11px] mb-0.5">
                  <span>🪙</span>
                  <span>{ch.price}</span>
                </div>
                <div className="text-[10px] text-gray-300 mb-1 capitalize">
                  {ch.tier === 'easy' ? 'Easy' : ch.tier === 'medium' ? 'Medium' : 'Rare'}
                </div>
                <div className="mt-auto text-[10px] font-semibold text-white">
                  {isSelected
                    ? 'Selected'
                    : isOwned
                    ? 'Equip'
                    : affordable
                    ? 'Buy & Equip'
                    : 'Locked'}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}


'use client';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ClipboardList, Map, ScrollText, Trophy, UploadCloud } from 'lucide-react';

const navItems = [
  { path: '/dashboard', label: 'Map', icon: Map, accent: 'from-teal-400 to-cyan-500' },
  { path: '/consultations', label: 'Logs', icon: ScrollText, accent: 'from-sky-400 to-blue-600' },
  { path: '/upload', label: 'Upload', icon: UploadCloud, accent: 'from-teal-400 to-blue-600' },
  { path: '/checklist', label: 'Quests', icon: ClipboardList, accent: 'from-cyan-400 to-teal-500' },
  { path: '/leaderboard', label: 'Rank', icon: Trophy, accent: 'from-blue-400 to-teal-500' },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === '/') return null;

  return (
    <motion.nav
      initial={{ y: 80 }}
      animate={{ y: 0 }}
      className="bottom-nav fixed bottom-0 left-0 right-0 z-50 px-3 pb-2"
    >
      <div className="quest-shell">
        <div className="relative flex items-center justify-around rounded-[1.65rem] border border-blue-200/70 bg-white/90 px-2 py-1.5 shadow-2xl shadow-blue-900/10 backdrop-blur-xl">
          <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/75 to-transparent" />
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          const Icon = item.icon;
          return (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className={`relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-[1.25rem] px-1 py-1.5 transition-all ${
                isActive
                  ? 'scale-[1.04] text-white'
                  : 'text-slate-500 opacity-90 hover:bg-cyan-50 hover:text-blue-700'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="navActiveBubble"
                  className={`absolute inset-1 rounded-[1.1rem] bg-gradient-to-b ${item.accent} opacity-95 shadow-lg shadow-cyan-500/15`}
                />
              )}
              <span
                className={`relative grid h-7 w-7 place-items-center rounded-[0.9rem] border transition ${
                  isActive
                    ? 'border-white/25 bg-white/18 text-white shadow-sm'
                    : 'border-blue-100 bg-white text-slate-400 shadow-sm'
                }`}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={2.4} />
              </span>
              <span
                className={`relative text-[10px] font-black leading-none ${
                  isActive ? 'text-white' : 'text-slate-500'
                }`}
              >
                {item.label}
              </span>
              {isActive && (
                <motion.div
                  layoutId="navIndicator"
                  className="absolute -bottom-1 h-1 w-9 rounded-full bg-white/80"
                />
              )}
            </button>
          );
        })}
        </div>
      </div>
    </motion.nav>
  );
}

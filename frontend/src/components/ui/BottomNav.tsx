'use client';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

const navItems = [
  { path: '/dashboard', label: 'Map', icon: '🗺️', accent: 'from-emerald-400 to-cyan-400' },
  { path: '/consultations', label: 'Logs', icon: '📋', accent: 'from-sky-400 to-blue-500' },
  { path: '/upload', label: 'Upload', icon: '📤', accent: 'from-orange-300 to-amber-500' },
  { path: '/checklist', label: 'Quests', icon: '✅', accent: 'from-lime-300 to-emerald-500' },
  { path: '/leaderboard', label: 'Rank', icon: '🏆', accent: 'from-fuchsia-300 to-violet-500' },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <motion.nav
      initial={{ y: 80 }}
      animate={{ y: 0 }}
      className="fixed bottom-0 left-0 right-0 z-50 px-3 pb-2"
    >
      <div className="quest-shell">
        <div className="relative flex items-center justify-around rounded-[1.65rem] border border-white/10 bg-slate-950/80 px-2 py-1.5 shadow-2xl shadow-slate-950/50 backdrop-blur-xl">
          <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent" />
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className={`relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-[1.25rem] px-1 py-1.5 transition-all ${
                isActive
                  ? 'scale-[1.04] text-white'
                  : 'text-slate-500 opacity-80 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="navActiveBubble"
                  className={`absolute inset-1 rounded-[1.1rem] bg-gradient-to-b ${item.accent} opacity-95 shadow-lg shadow-cyan-500/15`}
                />
              )}
              <span className="relative text-2xl leading-none drop-shadow">{item.icon}</span>
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


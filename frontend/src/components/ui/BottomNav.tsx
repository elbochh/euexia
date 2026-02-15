'use client';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

const navItems = [
  { path: '/dashboard', label: 'Map', icon: '🗺️' },
  { path: '/upload', label: 'Upload', icon: '📤' },
  { path: '/checklist', label: 'Tasks', icon: '✅' },
  { path: '/leaderboard', label: 'Rank', icon: '🏆' },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <motion.nav
      initial={{ y: 80 }}
      animate={{ y: 0 }}
      className="fixed bottom-0 left-0 right-0 z-50 pb-safe"
      style={{
        background: 'linear-gradient(0deg, rgba(22,33,62,0.98) 0%, rgba(22,33,62,0.9) 100%)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div className="max-w-lg mx-auto flex items-center justify-around py-2 px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all ${
                isActive
                  ? 'bg-blue-600/20 scale-110'
                  : 'opacity-60 hover:opacity-100'
              }`}
            >
              <span className="text-2xl">{item.icon}</span>
              <span
                className={`text-[10px] font-semibold ${
                  isActive ? 'text-blue-300' : 'text-gray-400'
                }`}
              >
                {item.label}
              </span>
              {isActive && (
                <motion.div
                  layoutId="navIndicator"
                  className="absolute -bottom-0.5 w-8 h-1 rounded-full bg-blue-500"
                />
              )}
            </button>
          );
        })}
      </div>
    </motion.nav>
  );
}


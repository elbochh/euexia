'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { authApi } from '@/lib/api';
import { useGameStore } from '@/stores/gameStore';

const floatingOrbs = [
  { size: 140, left: '8%', top: '10%', delay: 0 },
  { size: 92, left: '78%', top: '16%', delay: 1.1 },
  { size: 120, left: '62%', top: '74%', delay: 0.5 },
  { size: 70, left: '18%', top: '80%', delay: 1.8 },
];

const featureCards = [
  { icon: '🤖', label: 'Gemma 4 Guide', copy: 'AI turns visit notes into actionable quests.' },
  { icon: '🗺️', label: 'Living Map', copy: 'Progress unlocks paths, checkpoints, and rewards.' },
  { icon: '🏆', label: 'Daily Momentum', copy: 'Earn XP, coins, streaks, and leaderboard rank.' },
];

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, setUser, initFromStorage } = useGameStore();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    initFromStorage();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const res = await authApi.login({ email, password });
        setUser(res.data.user, res.data.token);
      } else {
        if (!name.trim()) {
          setError('Name is required');
          setLoading(false);
          return;
        }
        const res = await authApi.register({ email, password, name });
        setUser(res.data.user, res.data.token);
      }
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleContinueAsGuest = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await authApi.guest();
      setUser(res.data.user, res.data.token);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-screen min-h-screen relative overflow-hidden px-4 py-8">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {floatingOrbs.map((orb, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full blur-2xl animate-aurora"
            style={{
              width: orb.size,
              height: orb.size,
              left: orb.left,
              top: orb.top,
              background:
                i % 2 === 0
                  ? 'rgba(34, 197, 94, 0.18)'
                  : 'rgba(56, 189, 248, 0.18)',
              animationDelay: `${orb.delay}s`,
            }}
          />
        ))}
        <div className="absolute inset-x-8 top-12 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />
      </div>

      <div className="quest-shell relative z-10 flex min-h-[calc(100vh-4rem)] flex-col justify-center">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 text-center"
        >
          <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-[2rem] border border-white/15 bg-white/10 text-6xl shadow-2xl shadow-cyan-500/10">
            🏥
          </div>
          <div className="soft-badge mx-auto mb-3 text-cyan-100">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
            Gemma 4 health quest engine
          </div>
          <h1 className="text-5xl font-black tracking-tight">
            <span className="bg-gradient-to-r from-emerald-300 via-cyan-200 to-violet-300 bg-clip-text text-transparent">
              Euexia
            </span>
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-300">
            Turn medical follow-up instructions into a guided RPG map with quests,
            rewards, and Dr. Gemma by your side.
          </p>
        </motion.div>

        <motion.div
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="game-panel relative overflow-hidden p-5"
        >
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-cyan-400/10 blur-2xl" />
          <div className="relative mb-5 grid grid-cols-2 rounded-2xl border border-white/10 bg-slate-950/40 p-1">
            {['Login', 'Register'].map((tab, i) => {
              const active = (isLogin && i === 0) || (!isLogin && i === 1);
              return (
                <button
                  key={tab}
                  onClick={() => {
                    setIsLogin(i === 0);
                    setError('');
                  }}
                  className={`relative rounded-xl py-2.5 text-sm font-bold transition-all ${
                    active ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="authTab"
                      className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/20"
                    />
                  )}
                  <span className="relative">{tab}</span>
                </button>
              );
            })}
          </div>

          <form onSubmit={handleSubmit} className="relative space-y-3">
            <AnimatePresence mode="wait">
              {!isLogin && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                >
                  <input
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input-game"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input-game"
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="input-game"
            />

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-2xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-center text-xs text-red-200"
              >
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-game shimmer-sweep w-full text-base disabled:opacity-50"
            >
              {loading ? (
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="inline-block"
                >
                  ⚡
                </motion.span>
              ) : isLogin ? (
                'Enter the Quest'
              ) : (
                'Start Your Journey'
              )}
            </button>

            <button
              type="button"
              onClick={handleContinueAsGuest}
              disabled={loading}
              className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-bold text-slate-300 transition hover:border-cyan-300/40 hover:bg-cyan-300/10 hover:text-white disabled:opacity-50"
            >
              Continue as guest
            </button>
          </form>

          <p className="relative mt-4 text-center text-xs text-slate-500">
            Built for post-consultation care with Google Gemma 4
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mt-5 grid grid-cols-3 gap-2"
        >
          {featureCards.map((feat) => (
            <div key={feat.label} className="rounded-3xl border border-white/10 bg-white/[0.06] p-3 text-center backdrop-blur">
              <div className="mb-1 text-2xl">{feat.icon}</div>
              <div className="text-[11px] font-bold text-white">{feat.label}</div>
              <div className="mt-1 text-[9px] leading-3 text-slate-400">{feat.copy}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

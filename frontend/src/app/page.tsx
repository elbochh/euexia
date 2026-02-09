'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { authApi } from '@/lib/api';
import { useGameStore } from '@/stores/gameStore';

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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: 4 + Math.random() * 6,
              height: 4 + Math.random() * 6,
              background: `rgba(${100 + Math.random() * 155}, ${100 + Math.random() * 155}, 255, ${0.1 + Math.random() * 0.2})`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.2, 0.6, 0.2],
            }}
            transition={{
              duration: 3 + Math.random() * 4,
              repeat: Infinity,
              delay: Math.random() * 3,
            }}
          />
        ))}
      </div>

      {/* Logo */}
      <motion.div
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-center mb-8 relative z-10"
      >
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="text-7xl mb-4"
        >
          🏥
        </motion.div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-green-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
          Euexia
        </h1>
        <p className="text-gray-400 text-sm mt-1">Your Health Quest Begins</p>
      </motion.div>

      {/* Auth Form */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="game-panel p-6 w-full max-w-sm relative z-10"
      >
        {/* Toggle */}
        <div className="flex mb-6 bg-game-bg rounded-xl p-1">
          {['Login', 'Register'].map((tab, i) => (
            <button
              key={tab}
              onClick={() => {
                setIsLogin(i === 0);
                setError('');
              }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                (isLogin && i === 0) || (!isLogin && i === 1)
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-gray-400'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <AnimatePresence mode="wait">
            {!isLogin && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
              >
                <input
                  type="text"
                  placeholder="Your Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-game-bg border border-blue-500/30
                    text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/60
                    transition-colors text-sm"
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
            className="w-full px-4 py-3 rounded-xl bg-game-bg border border-blue-500/30
              text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/60
              transition-colors text-sm"
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full px-4 py-3 rounded-xl bg-game-bg border border-blue-500/30
              text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/60
              transition-colors text-sm"
          />

          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-red-400 text-xs text-center"
            >
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-game w-full text-base disabled:opacity-50"
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
        </form>

        <p className="text-center text-gray-500 text-xs mt-4">
          Powered by Google MedGemma AI
        </p>
      </motion.div>

      {/* Features preview */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex gap-6 mt-8 text-center relative z-10"
      >
        {[
          { icon: '🤖', label: 'AI Analysis' },
          { icon: '🗺️', label: 'Game Maps' },
          { icon: '🏆', label: 'Leaderboard' },
        ].map((feat) => (
          <div key={feat.label} className="text-center">
            <div className="text-2xl mb-1">{feat.icon}</div>
            <div className="text-[10px] text-gray-500">{feat.label}</div>
          </div>
        ))}
      </motion.div>
    </div>
  );
}


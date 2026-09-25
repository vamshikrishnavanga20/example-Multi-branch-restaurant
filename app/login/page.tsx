'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Loader2, ShieldCheck, Mail, Building2, Crown, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type LoginMode = 'super_admin' | 'branch';

export default function LoginPage() {
  const router = useRouter();

  // Mode toggle
  const [mode, setMode] = useState<LoginMode>('super_admin');

  // Super admin
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Branch login
  const [branchIdentifier, setBranchIdentifier] = useState('');
  const [branchPassword, setBranchPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const body = mode === 'super_admin'
        ? { email, password }
        : { branch_id: branchIdentifier.trim(), password: branchPassword };

      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Invalid credentials.');
        setLoading(false);
      } else {
        router.push('/admin');
        router.refresh();
      }
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090B] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-amber-600/4 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-amber-500/10">
            <Crown className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="font-serif text-3xl text-white font-bold tracking-tight">Example Project</h1>
          <p className="text-gray-400 text-sm mt-1 tracking-widest uppercase text-[10px] font-bold">Enterprise Gateway</p>
        </div>

        {/* Mode Switcher */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-1.5 flex gap-1.5 mb-6 backdrop-blur-xl">
          <button
            type="button"
            onClick={() => { setMode('super_admin'); setError(null); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
              mode === 'super_admin'
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-sm'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Super Admin
          </button>
          <button
            type="button"
            onClick={() => { setMode('branch'); setError(null); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
              mode === 'branch'
                ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30 shadow-sm'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Branch Login
          </button>
        </div>

        {/* Card */}
        <div className="bg-[#121214] border border-white/10 rounded-3xl p-8 shadow-2xl backdrop-blur-xl">

          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-4 rounded-xl mb-6 text-center font-medium"
            >
              {error}
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {mode === 'super_admin' ? (
              <motion.form
                key="super-admin"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                onSubmit={handleLogin}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs uppercase tracking-wider text-gray-400 mb-2">Admin Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-3.5 w-5 h-5 text-gray-500" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl pl-12 pr-4 py-3.5 text-white outline-none focus:border-amber-500/60 transition-colors"
                      placeholder="admin@example.com"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-gray-400 mb-2">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-3.5 w-5 h-5 text-gray-500" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl pl-12 pr-4 py-3.5 text-white outline-none focus:border-amber-500/60 transition-colors"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl text-sm font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 mt-2 bg-amber-500 hover:bg-amber-400 text-black disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                  {loading ? 'Authenticating…' : 'Access Command Center'}
                </button>
              </motion.form>
            ) : (
              <motion.form
                key="branch"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                onSubmit={handleLogin}
                className="space-y-4"
              >
                {/* Branch ID */}
                <div>
                  <label className="block text-xs uppercase tracking-wider text-gray-400 mb-2">Branch ID or Code</label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-3.5 w-5 h-5 text-gray-500" />
                    <input
                      type="text"
                      required
                      value={branchIdentifier}
                      onChange={(e) => setBranchIdentifier(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl pl-12 pr-4 py-3.5 text-white outline-none focus:border-sky-500/60 transition-colors font-mono"
                      placeholder="e.g. branch-hyderabad-hq or HYD-01"
                    />
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1.5 pl-1">
                    Enter your Branch ID (e.g. <span className="text-gray-400">branch-hyderabad-hq</span>) or Branch Code (<span className="text-gray-400">HYD-01</span>)
                  </p>
                </div>

                {/* Branch Password */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs uppercase tracking-wider text-gray-400">Branch Password</label>
                    <span className="text-[10px] text-sky-400 font-semibold uppercase tracking-wider">Manager Access</span>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-3.5 w-5 h-5 text-gray-500" />
                    <input
                      type="password"
                      required
                      value={branchPassword}
                      onChange={(e) => setBranchPassword(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl pl-12 pr-4 py-3.5 text-white outline-none focus:border-sky-500/60 transition-colors"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !branchIdentifier.trim() || !branchPassword}
                  className="w-full py-3.5 rounded-xl text-sm font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 mt-2 bg-sky-500 hover:bg-sky-400 text-white disabled:opacity-50 shadow-lg shadow-sky-500/20"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                  {loading ? 'Authenticating with AWS…' : 'Access Manager Dashboard'}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          Example Project · Enterprise Management System
        </p>
      </motion.div>
    </div>
  );
}
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../lib/api';
import { Spinner } from '../components/ui';

const ROLE_REDIRECT: Record<string, string> = {
    STUDENT: '/dashboard',
    PARENT: '/parent/dashboard',
    EDUCATOR: '/educator/dashboard',
    ADVISOR: '/advisor/dashboard',
    HOD: '/hod/dashboard',
    ADMIN: '/admin/dashboard',
};

type Mode = 'login' | 'register';

export function LoginPage() {
    const { isAuthenticated, role, login, register } = useAuth();
    const [mode, setMode] = useState<Mode>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (isAuthenticated) {
        const target = ROLE_REDIRECT[role ?? 'STUDENT'] ?? '/dashboard';
        return <Navigate to={target} replace />;
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            if (mode === 'login') await login(email, password);
            else await register(email, password);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Something went wrong.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div
            className="flex h-full items-center justify-center relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #f0f4ff 0%, #faf8ff 50%, #f0fdf9 100%)' }}
        >
            {/* Decorative blobs */}
            <div
                className="pointer-events-none absolute top-[-80px] left-[-80px] w-72 h-72 rounded-full opacity-40"
                style={{ background: 'radial-gradient(circle, #c7d2fe, transparent 70%)' }}
            />
            <div
                className="pointer-events-none absolute bottom-[-60px] right-[-60px] w-64 h-64 rounded-full opacity-30"
                style={{ background: 'radial-gradient(circle, #a7f3d0, transparent 70%)' }}
            />
            <div
                className="pointer-events-none absolute top-1/3 right-1/4 w-40 h-40 rounded-full opacity-20"
                style={{ background: 'radial-gradient(circle, #fde68a, transparent 70%)' }}
            />

            <div className="relative w-full max-w-sm animate-slide-up px-4">
                {/* Brand header */}
                <div className="mb-8 text-center">
                    <div className="flex justify-center mb-4">
                        <div
                            className="w-14 h-14 rounded-2xl flex items-center justify-center"
                            style={{
                                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 60%, #7c3aed 100%)',
                                boxShadow: '0 8px 24px rgba(79,70,229,0.35)',
                            }}
                        >
                            <svg viewBox="0 0 20 20" fill="white" className="w-7 h-7">
                                <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
                            </svg>
                        </div>
                    </div>
                    <h1
                        className="text-3xl font-bold"
                        style={{
                            background: 'linear-gradient(90deg, #4f46e5, #7c3aed)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                        }}
                    >
                        LearnSphere
                    </h1>
                    <p className="text-slate-500 text-sm mt-1.5">Your consistency, tracked.</p>
                </div>

                {/* Card */}
                <div
                    className="rounded-2xl p-6"
                    style={{
                        background: '#ffffff',
                        border: '1.5px solid #e4e8f4',
                        boxShadow: '0 8px 32px rgba(15,23,42,0.10), 0 2px 8px rgba(79,70,229,0.06)',
                    }}
                >
                    {/* Tab toggle */}
                    <div
                        className="flex rounded-xl p-1 mb-6"
                        style={{ background: '#f1f5f9' }}
                    >
                        {(['login', 'register'] as Mode[]).map((m) => (
                            <button
                                key={m}
                                id={`btn-${m}`}
                                onClick={() => { setMode(m); setError(null); }}
                                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all duration-200 ${mode === m
                                    ? 'bg-white text-indigo-600 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                {m === 'login' ? 'Sign in' : 'Sign up'}
                            </button>
                        ))}
                    </div>

                    <form id="form-auth" onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <div className="form-group">
                            <label className="form-label" htmlFor="email">Email</label>
                            <input
                                id="email"
                                type="email"
                                autoComplete="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="password">Password</label>
                            <input
                                id="password"
                                type="password"
                                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                minLength={8}
                            />
                            {mode === 'register' && (
                                <p className="text-xs text-slate-400 mt-1">Minimum 8 characters.</p>
                            )}
                        </div>

                        {error && (
                            <div className="alert-warning flex items-start gap-2">
                                <span>⚠</span>
                                <span>{error}</span>
                            </div>
                        )}

                        <button
                            id="btn-submit-auth"
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full mt-1"
                        >
                            {loading ? <Spinner size="sm" /> : mode === 'login' ? 'Sign in' : 'Create account'}
                        </button>
                    </form>

                    {/* Footer */}
                    <p className="text-center text-xs text-slate-400 mt-4">
                        {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                        <button
                            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}
                            className="font-semibold text-indigo-600 hover:text-indigo-700"
                        >
                            {mode === 'login' ? 'Sign up' : 'Sign in'}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
}

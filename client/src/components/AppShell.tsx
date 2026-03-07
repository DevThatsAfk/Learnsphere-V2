import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// ─── Role-specific nav configs ────────────────────────────────────────────────

type NavItem = { to: string; label: string; icon: string };

const NAV_BY_ROLE: Record<string, NavItem[]> = {
    STUDENT: [
        { to: '/dashboard', label: 'Dashboard', icon: '🏠' },
        { to: '/risk', label: 'My Risk Score', icon: '📊' },
        { to: '/sessions', label: 'Study Sessions', icon: '⏱️' },
        { to: '/reviews', label: 'Revision Queue', icon: '🔁' },
        { to: '/subjects', label: 'Subjects', icon: '📚' },
        { to: '/tasks', label: 'Tasks', icon: '✅' },
        { to: '/exams', label: 'Exams & Marks', icon: '📝' },
        { to: '/summarize', label: 'Smart Notes', icon: '✨' },
    ],
    PARENT: [
        { to: '/parent/dashboard', label: 'My Children', icon: '👨‍👧' },
    ],
    EDUCATOR: [
        { to: '/educator/dashboard', label: 'Cohort View', icon: '🎓' },
    ],
    ADVISOR: [
        { to: '/advisor/dashboard', label: 'My Students', icon: '👥' },
    ],
    HOD: [
        { to: '/hod/dashboard', label: 'Department', icon: '🏛️' },
    ],
    ADMIN: [
        { to: '/admin/dashboard', label: 'Dashboard', icon: '⚙️' },
    ],
};

// Role display info
const ROLE_META: Record<string, { label: string; color: string; bg: string }> = {
    STUDENT: { label: 'Student', color: '#10b981', bg: '#ecfdf5' },
    PARENT: { label: 'Parent', color: '#f59e0b', bg: '#fffbeb' },
    EDUCATOR: { label: 'Educator', color: '#3b82f6', bg: '#eff6ff' },
    ADVISOR: { label: 'Advisor', color: '#8b5cf6', bg: '#f5f3ff' },
    HOD: { label: 'HoD', color: '#6366f1', bg: '#eef2ff' },
    ADMIN: { label: 'Admin', color: '#ef4444', bg: '#fef2f2' },
};

export function AppShell({ children }: { children: React.ReactNode }) {
    const { logout, role, email } = useAuth();

    const currentRole = role ?? 'STUDENT';
    const navItems = NAV_BY_ROLE[currentRole] ?? NAV_BY_ROLE['STUDENT'];
    const meta = ROLE_META[currentRole] ?? ROLE_META['STUDENT'];

    return (
        <div className="flex h-full">
            {/* ── Sidebar ──────────────────────────────────────────── */}
            <aside
                className="flex w-56 flex-col shrink-0 px-3 py-5"
                style={{
                    background: '#ffffff',
                    borderRight: '1.5px solid #e4e8f4',
                    boxShadow: '2px 0 12px rgba(15,23,42,0.04)',
                }}
            >
                {/* Brand */}
                <div className="px-2 mb-5">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                            style={{
                                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 60%, #7c3aed 100%)',
                                boxShadow: '0 2px 8px rgba(79,70,229,0.35)',
                            }}
                        >
                            <svg viewBox="0 0 20 20" fill="white" className="w-4 h-4">
                                <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
                            </svg>
                        </div>
                        <div>
                            <span
                                className="text-sm font-bold tracking-tight"
                                style={{
                                    background: 'linear-gradient(90deg, #4f46e5, #7c3aed)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                }}
                            >
                                LearnSphere
                            </span>
                            <p className="text-xs text-slate-400 leading-none mt-0.5">Study smarter</p>
                        </div>
                    </div>
                </div>

                {/* Role badge */}
                <div className="px-2 mb-5">
                    <div
                        className="rounded-xl px-3 py-2 flex items-center gap-2"
                        style={{ background: meta.bg }}
                    >
                        <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ background: meta.color }}
                        />
                        <div className="min-w-0">
                            <p className="text-xs font-semibold" style={{ color: meta.color }}>{meta.label}</p>
                            <p className="text-xs text-slate-400 truncate">{email ?? ''}</p>
                        </div>
                    </div>
                </div>

                {/* Nav */}
                <p className="section-title px-2 mb-1">Navigation</p>
                <nav className="flex flex-col gap-0.5 flex-1">
                    {navItems.map(({ to, icon, label }) => (
                        <NavLink
                            key={to}
                            to={to}
                            className={({ isActive }) => isActive ? 'nav-item-active' : 'nav-item'}
                        >
                            <span className="text-base shrink-0 leading-none">{icon}</span>
                            <span className="truncate text-sm">{label}</span>
                        </NavLink>
                    ))}
                </nav>

                {/* Sign out */}
                <div className="mt-2" style={{ borderTop: '1.5px solid #e4e8f4', paddingTop: '12px' }}>
                    <button
                        id="btn-logout"
                        onClick={logout}
                        className="nav-item w-full text-slate-400 hover:text-red-500"
                    >
                        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
                            <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm">Sign out</span>
                    </button>
                </div>
            </aside>

            {/* ── Main ────────────────────────────────────────────────── */}
            <main
                className="flex-1 overflow-y-auto p-6 md:p-8"
                style={{ background: 'var(--clr-bg)' }}
            >
                {children}
            </main>
        </div>
    );
}

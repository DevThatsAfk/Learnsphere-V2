/**
 * AdminPortal.tsx — Admin portal with user management, audit log, system health, and CSV import.
 * Route: /admin/dashboard
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

interface User {
    id: string;
    email: string;
    role: string;
    departmentId?: string | null;
    rollNumber?: string | null;
    yearOfStudy?: number | null;
    section?: string | null;
    createdAt?: string;
}

interface Department {
    id: string;
    name: string;
}

interface HealthSnapshot {
    totalUsers: number;
    redRiskCount: number;
    pendingInterventions: number;
    checkedAt: string;
}

interface AuditEntry {
    id: string;
    action: string;
    target?: string | null;
    createdAt: string;
    user: { email: string };
}

const ROLES = ['STUDENT', 'PARENT', 'EDUCATOR', 'ADVISOR', 'HOD', 'ADMIN'];

export default function AdminPortal() {
    const { token: authToken } = useAuth(); const token = authToken ?? '';
    const authH = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const [tab, setTab] = useState<'health' | 'users' | 'audit' | 'import'>('health');
    const [health, setHealth] = useState<HealthSnapshot | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [totalUsers, setTotalUsers] = useState(0);
    const [page, setPage] = useState(1);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
    const [auditTotal, setAuditTotal] = useState(0);
    const [auditPage, setAuditPage] = useState(1);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [loading, setLoading] = useState(false);

    // New user form
    const [showNew, setShowNew] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newRole, setNewRole] = useState('STUDENT');
    const [newDept, setNewDept] = useState('');
    const [formError, setFormError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // CSV import
    const fileRef = useRef<HTMLInputElement>(null);
    const [importLog, setImportLog] = useState<string[]>([]);
    const [importing, setImporting] = useState(false);

    const fetchHealth = useCallback(async () => {
        const r = await fetch('/api/admin/system/health', { headers: authH });
        if (r.ok) setHealth(await r.json());
    }, [token]);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams({ page: String(page) });
        if (search) params.set('search', search);
        if (roleFilter) params.set('role', roleFilter);
        const r = await fetch(`/api/admin/users?${params}`, { headers: authH });
        if (r.ok) {
            const d = await r.json();
            setUsers(d.users ?? d);
            setTotalUsers(d.total ?? (d.users ?? d).length);
        }
        setLoading(false);
    }, [token, page, search, roleFilter]);

    const fetchDepts = useCallback(async () => {
        const r = await fetch('/api/admin/departments', { headers: authH });
        if (r.ok) setDepartments(await r.json());
    }, [token]);

    const fetchAudit = useCallback(async () => {
        const r = await fetch(`/api/admin/audit-logs?page=${auditPage}`, { headers: authH });
        if (r.ok) {
            const d = await r.json();
            setAuditLogs(d.logs ?? []);
            setAuditTotal(d.total ?? 0);
        }
    }, [token, auditPage]);

    useEffect(() => { fetchHealth(); fetchDepts(); }, []);
    useEffect(() => { if (tab === 'users') fetchUsers(); }, [tab, fetchUsers]);
    useEffect(() => { if (tab === 'audit') fetchAudit(); }, [tab, fetchAudit]);

    async function handleCreateUser() {
        setFormError('');
        if (!newEmail || !newPassword || !newRole) { setFormError('All fields required.'); return; }
        if (newPassword.length < 8) { setFormError('Password must be ≥ 8 characters.'); return; }
        setSubmitting(true);
        try {
            const r = await fetch('/api/admin/users', {
                method: 'POST', headers: authH,
                body: JSON.stringify({ email: newEmail, password: newPassword, role: newRole, departmentId: newDept || undefined }),
            });
            if (r.ok) {
                setShowNew(false);
                setNewEmail(''); setNewPassword(''); setNewRole('STUDENT'); setNewDept('');
                fetchUsers();
            } else {
                const e = await r.json();
                setFormError(e.error ?? e.message ?? 'Failed to create user.');
            }
        } finally { setSubmitting(false); }
    }

    async function handleDeleteUser(id: string, email: string) {
        if (!confirm(`Delete ${email}?`)) return;
        await fetch(`/api/admin/users/${id}`, { method: 'DELETE', headers: authH });
        fetchUsers();
    }

    async function handleImport() {
        const file = fileRef.current?.files?.[0];
        if (!file) { setImportLog(['⚠️ No file selected.']); return; }
        setImporting(true);
        setImportLog(['⏳ Uploading…']);
        const form = new FormData();
        form.append('file', file);
        try {
            const r = await fetch('/api/admin/users/bulk-import', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: form,
            });
            const d = await r.json();
            if (r.ok) {
                const lines: string[] = [];
                if (d.summary) {
                    lines.push(`✅ Imported: ${d.summary.imported}  ⏭ Skipped: ${d.summary.skipped}  ❌ Failed: ${d.summary.failed}  (${d.summary.total} total rows)`);
                    d.results?.filter((row: { status: string }) => row.status !== 'IMPORTED')
                        .slice(0, 20)
                        .forEach((row: { row: number; email: string; status: string; reason?: string }) =>
                            lines.push(`  Row ${row.row} [${row.status}] ${row.email}${row.reason ? ` — ${row.reason}` : ''}`));
                } else if (d.created) {
                    lines.push(`✅ ${d.created} users created`);
                    if (d.skipped) lines.push(`⚠️ ${d.skipped} skipped`);
                }
                setImportLog(lines.length ? lines : ['✅ Import complete.']);
                fetchUsers();
            } else {
                setImportLog([`❌ ${d.error ?? d.message ?? 'Import failed.'}`]);
            }
        } catch (e) {
            setImportLog(['❌ Network error during import.']);
        } finally { setImporting(false); }
    }

    const TABS = [
        { id: 'health', label: '🏥 System Health' },
        { id: 'users', label: '👥 Users' },
        { id: 'audit', label: '📋 Audit Log' },
        { id: 'import', label: '📤 Bulk Import' },
    ] as const;

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Admin Dashboard</h1>
                <p className="text-sm text-slate-500 mt-1">Manage users, monitor system health, review audit logs, and import data.</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id
                            ? 'bg-white text-indigo-600 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ── Health ── */}
            {tab === 'health' && (
                <div className="space-y-6">
                    {health ? (
                        <>
                            <div className="grid grid-cols-3 gap-4">
                                {[
                                    { label: 'Total Users', value: health.totalUsers, icon: '👤', color: 'text-indigo-600', bg: 'bg-indigo-50' },
                                    { label: 'RED Risk Students', value: health.redRiskCount, icon: '🔴', color: 'text-red-600', bg: 'bg-red-50' },
                                    { label: 'Pending Interventions', value: health.pendingInterventions, icon: '⏳', color: 'text-amber-600', bg: 'bg-amber-50' },
                                ].map(s => (
                                    <div key={s.label} className={`rounded-2xl border border-slate-200 bg-white p-6 flex items-center gap-4 shadow-sm`}>
                                        <div className={`w-12 h-12 rounded-xl ${s.bg} flex items-center justify-center text-2xl`}>{s.icon}</div>
                                        <div>
                                            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                                            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs text-slate-400">Last checked: {new Date(health.checkedAt).toLocaleString()}</p>
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-40">
                            <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
                        </div>
                    )}

                    {/* Department list */}
                    <div>
                        <h2 className="text-sm font-semibold text-slate-700 mb-3">Departments</h2>
                        <div className="grid grid-cols-2 gap-3">
                            {departments.map(d => (
                                <div key={d.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm flex items-center gap-3">
                                    <span className="text-xl">🏛️</span>
                                    <p className="text-sm font-medium text-slate-700">{d.name}</p>
                                </div>
                            ))}
                            {departments.length === 0 && (
                                <p className="text-sm text-slate-400 col-span-2">No departments found.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Users ── */}
            {tab === 'users' && (
                <div className="space-y-4">
                    {/* Search + Filter + Add */}
                    <div className="flex flex-wrap gap-3 items-center">
                        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                            placeholder="Search by email…"
                            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 w-60 shadow-sm" />
                        <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 shadow-sm">
                            <option value="">All Roles</option>
                            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <button onClick={fetchUsers}
                            className="rounded-xl bg-slate-100 hover:bg-slate-200 px-4 py-2 text-sm text-slate-600 font-medium transition-colors shadow-sm">
                            🔄 Refresh
                        </button>
                        <button onClick={() => setShowNew(true)}
                            className="ml-auto rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-sm font-medium transition-colors shadow-sm">
                            + Add User
                        </button>
                    </div>

                    {/* Table */}
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-xs text-slate-500 border-b border-slate-100 bg-slate-50">
                                    <th className="text-left px-4 py-3 font-medium">Email</th>
                                    <th className="text-left px-4 py-3 font-medium">Role</th>
                                    <th className="text-left px-4 py-3 font-medium">Roll No.</th>
                                    <th className="text-left px-4 py-3 font-medium">Year</th>
                                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={5} className="text-center py-12 text-slate-400">Loading…</td></tr>
                                ) : users.length === 0 ? (
                                    <tr><td colSpan={5} className="text-center py-12 text-slate-400">No users found.</td></tr>
                                ) : (
                                    users.map(u => (
                                        <tr key={u.id} className="border-b border-slate-50 hover:bg-indigo-50/30 transition-colors">
                                            <td className="px-4 py-3 font-medium text-slate-700">{u.email}</td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' :
                                                    u.role === 'HOD' ? 'bg-indigo-100 text-indigo-700' :
                                                        u.role === 'EDUCATOR' ? 'bg-blue-100 text-blue-700' :
                                                            u.role === 'ADVISOR' ? 'bg-teal-100 text-teal-700' :
                                                                u.role === 'PARENT' ? 'bg-orange-100 text-orange-700' :
                                                                    'bg-emerald-100 text-emerald-700'}`}>
                                                    {u.role}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-500">{u.rollNumber ?? '—'}</td>
                                            <td className="px-4 py-3 text-slate-500">{u.yearOfStudy ?? '—'}</td>
                                            <td className="px-4 py-3 text-right">
                                                <button onClick={() => handleDeleteUser(u.id, u.email)}
                                                    className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors">
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>

                        {/* Pagination */}
                        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
                            <p className="text-xs text-slate-500">{totalUsers} users total</p>
                            <div className="flex gap-2">
                                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                                    className="px-3 py-1 rounded-lg text-xs border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors shadow-sm">
                                    ← Prev
                                </button>
                                <span className="px-3 py-1 text-xs text-slate-600">Page {page}</span>
                                <button disabled={users.length < 20} onClick={() => setPage(p => p + 1)}
                                    className="px-3 py-1 rounded-lg text-xs border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors shadow-sm">
                                    Next →
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Audit Log ── */}
            {tab === 'audit' && (
                <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-xs text-slate-500 border-b border-slate-100 bg-slate-50">
                                    <th className="text-left px-4 py-3 font-medium">Action</th>
                                    <th className="text-left px-4 py-3 font-medium">Performed by</th>
                                    <th className="text-left px-4 py-3 font-medium">Target ID</th>
                                    <th className="text-left px-4 py-3 font-medium">Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                {auditLogs.length === 0 ? (
                                    <tr><td colSpan={4} className="text-center py-12 text-slate-400">No audit entries found.</td></tr>
                                ) : (
                                    auditLogs.map(l => (
                                        <tr key={l.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3">
                                                <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-mono font-semibold ${l.action.includes('delete') ? 'bg-red-100 text-red-700' :
                                                    l.action.includes('create') ? 'bg-green-100 text-green-700' :
                                                        'bg-blue-100 text-blue-700'}`}>
                                                    {l.action}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600">{l.user?.email ?? '—'}</td>
                                            <td className="px-4 py-3 text-slate-400 font-mono text-xs truncate max-w-[140px]">{l.target ?? '—'}</td>
                                            <td className="px-4 py-3 text-slate-400 text-xs">{new Date(l.createdAt).toLocaleString()}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
                            <p className="text-xs text-slate-500">{auditTotal} entries total</p>
                            <div className="flex gap-2">
                                <button disabled={auditPage === 1} onClick={() => setAuditPage(p => p - 1)}
                                    className="px-3 py-1 rounded-lg text-xs border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 shadow-sm">
                                    ← Prev
                                </button>
                                <span className="px-3 py-1 text-xs text-slate-600">Page {auditPage}</span>
                                <button disabled={auditLogs.length < 50} onClick={() => setAuditPage(p => p + 1)}
                                    className="px-3 py-1 rounded-lg text-xs border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 shadow-sm">
                                    Next →
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Bulk Import ── */}
            {tab === 'import' && (
                <div className="space-y-6 max-w-lg">
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
                        <div>
                            <h2 className="text-sm font-semibold text-slate-700">Bulk CSV Import</h2>
                            <p className="text-xs text-slate-500 mt-1">Upload a CSV with columns: <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">email,password,role,department,rollNumber,yearOfStudy,section,parentEmail,advisorEmail</code></p>
                        </div>

                        <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-indigo-300 transition-colors">
                            <p className="text-2xl mb-2">📄</p>
                            <input ref={fileRef} type="file" accept=".csv"
                                className="hidden" id="csv-upload" />
                            <label htmlFor="csv-upload"
                                className="cursor-pointer text-sm text-indigo-600 font-medium hover:underline">
                                Choose CSV file
                            </label>
                            <p className="text-xs text-slate-400 mt-1">or drag and drop</p>
                        </div>

                        <button onClick={handleImport} disabled={importing}
                            className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2.5 text-sm font-medium transition-colors shadow-sm">
                            {importing ? '⏳ Importing…' : '🚀 Start Import'}
                        </button>

                        {importLog.length > 0 && (
                            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-1.5">
                                {importLog.map((line, i) => (
                                    <p key={i} className="text-xs font-mono text-slate-600">{line}</p>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Create User Modal ── */}
            {showNew && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4 border border-slate-200">
                        <div className="flex items-center justify-between">
                            <h2 className="text-base font-bold text-slate-800">Add New User</h2>
                            <button onClick={() => setShowNew(false)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
                        </div>
                        {formError && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{formError}</p>}
                        <div className="space-y-3">
                            <input value={newEmail} onChange={e => setNewEmail(e.target.value)}
                                placeholder="Email" type="email"
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                            <input value={newPassword} onChange={e => setNewPassword(e.target.value)}
                                placeholder="Password (min 8 chars)" type="password"
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                            <select value={newRole} onChange={e => setNewRole(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                            {['STUDENT', 'HOD', 'EDUCATOR', 'ADVISOR'].includes(newRole) && (
                                <select value={newDept} onChange={e => setNewDept(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                                    <option value="">Select Department (optional)</option>
                                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            )}
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button onClick={handleCreateUser} disabled={submitting}
                                className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2.5 text-sm font-medium transition-colors">
                                {submitting ? 'Creating…' : 'Create User'}
                            </button>
                            <button onClick={() => setShowNew(false)}
                                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 py-2.5 text-sm font-medium transition-colors">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}



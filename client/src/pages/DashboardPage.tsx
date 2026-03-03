import { useEffect, useState, useCallback } from 'react';
import { analyticsApi } from '../lib/api';
import { useSubjects } from '../context/SubjectsContext';
import type {
    TodayOverview,
    AnalyticsSnapshot,
    ConsistencyDay,
    NeglectSignal,
    Subject,
} from '../types/api';
import {
    FullPageSpinner,
    ErrorBanner,
    EmptyState,
    ProgressBar,
} from '../components/ui';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    Cell,
    ReferenceLine,
} from 'recharts';

// ─── Helpers ─────────────────────────────────────────────────────
function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function formatMonth(iso: string) {
    return new Date(iso).toLocaleDateString('en-GB', { month: 'short' });
}

function subjectName(subjectId: string, subjects: Subject[]) {
    return subjects.find(s => s.id === subjectId)?.name ?? subjectId.slice(0, 8) + '…';
}

// ─── Stat Card ───────────────────────────────────────────────────
function StatCard({
    label,
    value,
    unit,
    accent = 'primary',
}: {
    label: string;
    value: number | string;
    unit?: string;
    accent?: 'primary' | 'accent' | 'success' | 'warning';
}) {
    const colors: Record<string, string> = {
        primary: 'text-primary-400',
        accent: 'text-accent-400',
        success: 'text-green-400',
        warning: 'text-amber-400',
    };
    return (
        <div className="card flex flex-col gap-1">
            <p className="section-title">{label}</p>
            <div className="flex items-baseline gap-1.5">
                <span className={`text-4xl font-bold tabular-nums ${colors[accent]}`}>{value}</span>
                {unit && <span className="text-muted text-sm">{unit}</span>}
            </div>
        </div>
    );
}

// ─── Marks Bar Chart (Feature 6 — lowest = weakest) ──────────────
function MarksChart({ snapshots, subjects }: { snapshots: AnalyticsSnapshot[]; subjects: Subject[] }) {
    // Only include subjects that have marks data
    const withMarks = snapshots
        .filter(s => s.average_marks !== null)
        .map(s => ({
            name: subjectName(s.subject_id, subjects).slice(0, 12),
            marks: s.average_marks as number,
            fullName: subjectName(s.subject_id, subjects),
        }))
        // Sort ascending — lowest bar (weakest) at left
        .sort((a, b) => a.marks - b.marks);

    if (withMarks.length === 0) {
        return (
            <div className="card">
                <p className="section-title">Marks by Subject</p>
                <EmptyState title="No marks recorded yet" description="Add exam marks to see subject-wise performance." />
            </div>
        );
    }

    // Colour: red ≤ 40, amber ≤ 60, yellow ≤ 75, green > 75
    function barColor(marks: number): string {
        if (marks <= 40) return '#ef4444';
        if (marks <= 60) return '#f59e0b';
        if (marks <= 75) return '#eab308';
        return '#22c55e';
    }

    const weakest = withMarks[0];

    // Custom tooltip
    const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: { fullName: string; marks: number } }[] }) => {
        if (!active || !payload?.length) return null;
        const d = payload[0].payload;
        return (
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '8px 14px', fontSize: 12, color: '#e2e8f0' }}>
                <p className="font-medium">{d.fullName}</p>
                <p style={{ color: barColor(d.marks) }}>{d.marks}%</p>
            </div>
        );
    };

    return (
        <div className="card">
            <div className="flex items-start justify-between mb-1">
                <div>
                    <p className="section-title mb-0">Marks by Subject</p>
                    <p className="text-xs text-muted mt-0.5">Sorted weakest → strongest. Lowest bar needs most attention.</p>
                </div>
                {withMarks.length > 0 && (
                    <span className="text-xs text-red-400 bg-red-900/20 border border-red-700/30 rounded-lg px-2 py-1">
                        ⚠ weakest: {weakest.fullName}
                    </span>
                )}
            </div>
            <ResponsiveContainer width="100%" height={200}>
                <BarChart data={withMarks} margin={{ top: 16, right: 8, left: -20, bottom: 4 }}>
                    <XAxis
                        dataKey="name"
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <YAxis
                        domain={[0, 100]}
                        tick={{ fill: '#64748b', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={v => `${v}%`}
                    />
                    {/* Reference lines for grade zones */}
                    <ReferenceLine y={40} stroke="#ef444450" strokeDasharray="3 3" />
                    <ReferenceLine y={75} stroke="#22c55e40" strokeDasharray="3 3" />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
                    <Bar dataKey="marks" radius={[6, 6, 0, 0]}>
                        {withMarks.map((entry, i) => (
                            <Cell key={i} fill={barColor(entry.marks)} fillOpacity={0.85} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" /> ≤40%</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" /> ≤60%</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-yellow-500 inline-block" /> ≤75%</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block" /> &gt;75%</span>
            </div>
        </div>
    );
}

// ─── Minutes Bar Chart ────────────────────────────────────────────
function MinutesChart({ snapshots, subjects }: { snapshots: AnalyticsSnapshot[]; subjects: Subject[] }) {
    const data = snapshots.map(s => ({
        name: subjectName(s.subject_id, subjects).slice(0, 10),
        minutes: s.total_active_minutes,
    }));

    const COLORS = ['#6366f1', '#8b5cf6', '#38bdf8', '#22c55e', '#f59e0b', '#ec4899', '#14b8a6'];

    return (
        <div className="card">
            <p className="section-title">Study Minutes by Subject</p>
            {data.length === 0 ? (
                <EmptyState title="No sessions yet" description="Start a study session to see data here." />
            ) : (
                <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={data} margin={{ top: 8, right: 0, left: -24, bottom: 0 }}>
                        <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip
                            contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, color: '#e2e8f0', fontSize: 12 }}
                            cursor={{ fill: 'rgba(99,102,241,0.08)' }}
                            formatter={(v: number | undefined) => [`${v ?? 0} min`, 'Active']}
                        />
                        <Bar dataKey="minutes" radius={[6, 6, 0, 0]}>
                            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            )}
        </div>
    );
}

// ─── Consistency Heatmap (upgraded: day labels + month badge) ────
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function ConsistencyHeatmap({ days }: { days: ConsistencyDay[] }) {
    // Pad to start on Monday
    const firstDayOfWeek = days.length > 0
        ? (new Date(days[0].date).getDay() + 6) % 7  // 0=Mon … 6=Sun
        : 0;

    // Build a padded flat array: nulls for empty leading cells, then real days
    const padded: (ConsistencyDay | null)[] = [
        ...Array(firstDayOfWeek).fill(null),
        ...days,
    ];

    // Split into weeks
    const weeks: (ConsistencyDay | null)[][] = [];
    for (let i = 0; i < padded.length; i += 7) {
        weeks.push(padded.slice(i, i + 7));
    }

    // Find month change weeks (to show month badge above the week)
    const monthLabels: Record<number, string> = {};
    days.forEach(d => {
        const weekIdx = Math.floor((firstDayOfWeek + days.indexOf(d)) / 7);
        const m = formatMonth(d.date);
        if (!Object.values(monthLabels).includes(m)) monthLabels[weekIdx] = m;
    });

    const activeDays = days.filter(d => d.is_active).length;

    return (
        <div className="card">
            <div className="flex items-center justify-between mb-3">
                <div>
                    <p className="section-title mb-0">Study Consistency</p>
                    <p className="text-xs text-muted mt-0.5">{activeDays} active days this period</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted">
                    <span className="w-3 h-3 rounded-sm bg-surface-900 border border-slate-700/40 inline-block" /> none
                    <span className="w-3 h-3 rounded-sm bg-primary-800/60 inline-block" /> partial
                    <span className="w-3 h-3 rounded-sm bg-primary-500 inline-block" /> active
                </div>
            </div>

            <div className="flex gap-1.5">
                {/* Day-of-week column labels */}
                <div className="flex flex-col gap-1.5 shrink-0 justify-start pt-6">
                    {DAY_LABELS.map((d, i) => (
                        <span key={i} className="text-muted" style={{ fontSize: 9, lineHeight: '28px', height: 28, display: 'block', textAlign: 'right', width: 10 }}>
                            {d}
                        </span>
                    ))}
                </div>

                {/* Grid weeks */}
                <div className="flex gap-1.5 flex-1 overflow-x-auto pb-1">
                    {weeks.map((week, wi) => (
                        <div key={wi} className="flex flex-col gap-1.5 shrink-0">
                            {/* Month badge above first week of each month */}
                            <span className="text-muted shrink-0" style={{ fontSize: 9, height: 14, lineHeight: '14px', whiteSpace: 'nowrap' }}>
                                {monthLabels[wi] ?? ''}
                            </span>
                            {week.map((day, di) => (
                                day === null ? (
                                    <div key={`pad-${di}`} className="h-7 w-7 rounded-md" />
                                ) : (
                                    <div
                                        key={day.date}
                                        title={`${formatDate(day.date)} — ${day.active_minutes} min${day.is_active ? ' ✓' : ''}`}
                                        className={`h-7 w-7 rounded-md transition-all duration-200 cursor-default ${day.is_active
                                            ? 'bg-primary-500 hover:bg-primary-400 shadow-sm shadow-primary-500/30'
                                            : day.active_minutes > 0
                                                ? 'bg-primary-800/60 hover:bg-primary-700/70'
                                                : 'bg-surface-900 border border-slate-700/30 hover:bg-slate-700/30'
                                            }`}
                                    />
                                )
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── Neglect Signals ─────────────────────────────────────────────
function NeglectPanel({ signals, subjects }: { signals: NeglectSignal[]; subjects: Subject[] }) {
    if (signals.length === 0) {
        return (
            <div className="card">
                <p className="section-title">Neglect Signals</p>
                <div className="flex items-center gap-2 mt-3 text-green-400 text-sm">
                    <span>✓</span>
                    <span>All subjects have recent activity.</span>
                </div>
            </div>
        );
    }
    return (
        <div className="card border-amber-600/30">
            <p className="section-title">Neglect Signals</p>
            <p className="text-xs text-muted mb-3">Subjects with no activity for ≥ 14 days — needs attention.</p>
            <ul className="flex flex-col gap-2.5">
                {signals.map(sig => {
                    const pct = Math.min(100, Math.round((sig.days_since_last_activity / 30) * 100));
                    return (
                        <li key={sig.subject_id} className="flex flex-col gap-1">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-300 font-medium">{subjectName(sig.subject_id, subjects)}</span>
                                <span className="badge-warning">{sig.days_since_last_activity}d since last activity</span>
                            </div>
                            <ProgressBar value={pct} max={100} />
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

// ─── Subject Performance Table ────────────────────────────────────
function SubjectTable({ snapshots, subjects }: { snapshots: AnalyticsSnapshot[]; subjects: Subject[] }) {
    if (snapshots.length === 0) return null;

    // Sort by average_marks ascending (weakest first) for table too
    const sorted = [...snapshots].sort((a, b) => {
        if (a.average_marks === null && b.average_marks === null) return 0;
        if (a.average_marks === null) return 1;
        if (b.average_marks === null) return -1;
        return a.average_marks - b.average_marks;
    });

    return (
        <div className="card">
            <p className="section-title">Subject Performance</p>
            <p className="text-xs text-muted mb-3">Sorted weakest first. Subjects without marks appear at the bottom.</p>
            <table className="w-full mt-2 text-sm">
                <thead>
                    <tr className="text-left text-muted border-b border-slate-700/60">
                        <th className="pb-2 font-medium">Subject</th>
                        <th className="pb-2 font-medium text-right">Minutes</th>
                        <th className="pb-2 font-medium text-right">Avg Marks</th>
                    </tr>
                </thead>
                <tbody>
                    {sorted.map(s => {
                        const isWeak = s.average_marks !== null && s.average_marks <= 40;
                        const isGood = s.average_marks !== null && s.average_marks > 75;
                        return (
                            <tr key={s.subject_id} className="border-b border-slate-700/30 last:border-0 hover:bg-white/2">
                                <td className="py-2.5 text-slate-300 font-medium flex items-center gap-2">
                                    {isWeak && <span className="text-red-400 text-xs">▼</span>}
                                    {isGood && <span className="text-green-400 text-xs">▲</span>}
                                    {subjectName(s.subject_id, subjects)}
                                </td>
                                <td className="py-2.5 text-right tabular-nums text-primary-400">{s.total_active_minutes}</td>
                                <td className="py-2.5 text-right">
                                    {s.average_marks !== null
                                        ? <span className={s.average_marks <= 40 ? 'badge-warning text-red-400' : s.average_marks > 75 ? 'badge-success' : 'badge-info'}>{s.average_marks}%</span>
                                        : <span className="text-muted">—</span>}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// ─── Dashboard Page ───────────────────────────────────────────────
export function DashboardPage() {
    const [today, setToday] = useState<TodayOverview | null>(null);
    const [overview, setOverview] = useState<AnalyticsSnapshot[]>([]);
    const [consistency, setConsistency] = useState<ConsistencyDay[]>([]);
    const [neglect, setNeglect] = useState<NeglectSignal[]>([]);
    const { subjects } = useSubjects();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const [t, o, c, n] = await Promise.all([
                analyticsApi.today(),
                analyticsApi.overview(),
                analyticsApi.consistency(),
                analyticsApi.neglect(),
            ]);
            setToday(t); setOverview(o); setConsistency(c); setNeglect(n);
        } catch {
            setError('Could not load dashboard. Check your connection.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    if (loading) return <FullPageSpinner />;
    if (error) return <div className="py-8"><ErrorBanner message={error} onRetry={load} /></div>;

    const activeDays = consistency.filter(d => d.is_active).length;
    const avgMarks = (() => {
        const withMarks = overview.filter(s => s.average_marks !== null);
        if (!withMarks.length) return null;
        return Math.round(withMarks.reduce((a, s) => a + (s.average_marks ?? 0), 0) / withMarks.length);
    })();

    const hasAnyData = overview.length > 0 || consistency.some(d => d.is_active);

    return (
        <div className="animate-slide-up space-y-5 max-w-4xl">
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1>Dashboard</h1>
                    <p className="text-muted text-sm mt-0.5">Your learning overview, updated in real time.</p>
                </div>
                <button id="btn-refresh-dashboard" onClick={load} className="btn-ghost btn-sm text-muted">
                    ↻ Refresh
                </button>
            </div>

            {!hasAnyData ? (
                <div className="card">
                    <EmptyState
                        title="Your dashboard is waiting"
                        description="Add subjects, start a study session, and come back to see your analytics."
                    />
                </div>
            ) : (
                <>
                    {/* Stat row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard label="Today's Minutes" value={today?.total_active_minutes ?? 0} unit="min" accent="primary" />
                        <StatCard label="Sessions Today" value={today?.sessions_count ?? 0} unit="sessions" accent="accent" />
                        <StatCard label="Active Days (30d)" value={activeDays} unit="days" accent="success" />
                        <StatCard
                            label="Avg Marks"
                            value={avgMarks !== null ? `${avgMarks}%` : '—'}
                            accent="warning"
                        />
                    </div>

                    {/* Today's progress */}
                    {today && today.total_active_minutes > 0 && (
                        <div className="card">
                            <div className="flex justify-between items-center mb-2">
                                <p className="text-sm font-medium text-slate-300">Today's study progress</p>
                                <span className="text-xs text-muted">{today.total_active_minutes} / 18 min for active day</span>
                            </div>
                            <ProgressBar value={today.total_active_minutes} max={18} />
                        </div>
                    )}

                    {/* ── GRAPHICAL SECTION (Feature 6) ─────────────────── */}

                    {/* 1. Consistency calendar (full width) */}
                    {consistency.length > 0 && <ConsistencyHeatmap days={consistency} />}

                    {/* 2. Marks bar chart (Feature 6 — lowest = weakest) */}
                    <MarksChart snapshots={overview} subjects={subjects} />

                    {/* 3. Study minutes chart */}
                    {overview.length > 0 && <MinutesChart snapshots={overview} subjects={subjects} />}

                    {/* 4. Two-column: neglect + performance table */}
                    <div className="grid md:grid-cols-2 gap-4">
                        <NeglectPanel signals={neglect} subjects={subjects} />
                        {overview.length > 0 && <SubjectTable snapshots={overview} subjects={subjects} />}
                    </div>
                </>
            )}
        </div>
    );
}

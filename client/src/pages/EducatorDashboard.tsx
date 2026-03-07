/**
 * EducatorDashboard.tsx — Educator's intervention management dashboard.
 * Route: /educator/dashboard
 *
 * Shows: RED/AMBER student list, create intervention modal, pending interventions list.
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { RiskScoreCard } from '../components/RiskScoreCard';
import { InterventionTimeline } from '../components/InterventionTimeline';
import type { InterventionTimelineProps } from '../components/InterventionTimeline';

interface CohortStudent {
    userId: string;
    score: number;
    level: 'GREEN' | 'AMBER' | 'RED';
    calculatedAt: string;
    user: { id: string; email: string; rollNumber?: string | null };
    flags: { type: string; detail: string; weight: number }[];
}

interface Intervention {
    id: string;
    studentId: string;
    status: InterventionTimelineProps['status'];
    createdAt: string;
    sentAt?: string | null;
    seenAt?: string | null;
    finalPlan?: string | null;
    aiPlan?: string | null;
    educatorNote?: string | null;
    student: { id: string; email: string; rollNumber?: string | null };
    outcome?: { deltaScore?: number | null; resolvedAt?: string; studentFeedback?: string | null } | null;
}

export default function EducatorDashboard() {
    const [cohort, setCohort] = useState<CohortStudent[]>([]);
    const [pending, setPending] = useState<Intervention[]>([]);
    const [tab, setTab] = useState<'cohort' | 'pending'>('cohort');
    const [creating, setCreating] = useState<string | null>(null); // studentId
    const [riskScoreId, setRiskScoreId] = useState<string>('');
    const [aiDraft, setAiDraft] = useState(true);
    const [educatorNote, setEducatorNote] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const { token: authToken } = useAuth(); const token = authToken ?? '';
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const fetchData = useCallback(async () => {
        const [cRes, pRes] = await Promise.all([
            fetch('/api/risk/cohort', { headers: { Authorization: `Bearer ${token}` } }),
            fetch('/api/interventions/pending', { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (cRes.ok) setCohort(await cRes.json());
        if (pRes.ok) setPending(await pRes.json());
        setLoading(false);
    }, [token]);

    useEffect(() => { fetchData(); }, [fetchData]);

    async function handleCreateIntervention() {
        if (!creating || !riskScoreId) return;
        setSubmitting(true);
        try {
            await fetch('/api/interventions', {
                method: 'POST',
                headers,
                body: JSON.stringify({ studentId: creating, riskScoreId, useAIDraft: aiDraft, educatorNote }),
            });
            setCreating(null);
            setRiskScoreId('');
            setEducatorNote('');
            await fetchData();
        } finally {
            setSubmitting(false);
        }
    }

    const atRisk = cohort.filter(s => s.level !== 'GREEN');

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Educator Dashboard</h1>
                <p className="text-sm text-slate-500 mt-1">Monitor at-risk students and manage interventions.</p>
            </div>

            {/* Stat bar */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'RED', value: cohort.filter(s => s.level === 'RED').length, color: 'text-red-400' },
                    { label: 'AMBER', value: cohort.filter(s => s.level === 'AMBER').length, color: 'text-amber-400' },
                    { label: 'Pending Review', value: pending.length, color: 'text-indigo-400' },
                ].map(stat => (
                    <div key={stat.label} className="card text-center">
                        <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                        <p className="text-xs text-slate-500 mt-1">{stat.label}</p>
                    </div>
                ))}
            </div>

            {/* Tab bar */}
            <div className="flex gap-2">
                {(['cohort', 'pending'] as const).map(t => (
                    <button key={t} onClick={() => setTab(t)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${tab === t ? 'bg-indigo-500 text-white' : 'text-slate-500 hover:text-slate-700'}`}>
                        {t === 'cohort' ? `At-Risk Students (${atRisk.length})` : `Pending Approval (${pending.length})`}
                    </button>
                ))}
            </div>

            {/* Cohort tab */}
            {tab === 'cohort' && (
                <div className="space-y-3">
                    {atRisk.length === 0 && <p className="text-center text-slate-500 py-12 text-sm">No students at risk. 🎉</p>}
                    {atRisk.map(s => (
                        <div key={s.userId} className="card flex items-center justify-between gap-4">
                            <div className="min-w-0">
                                <p className="font-medium text-slate-700 truncate">{s.user.email}</p>
                                {s.user.rollNumber && <p className="text-xs text-slate-500">{s.user.rollNumber}</p>}
                                {s.flags.length > 0 && <p className="text-xs text-amber-400 mt-1">⚑ {s.flags[0].detail}</p>}
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                                <RiskScoreCard score={s.score} level={s.level} compact />
                                <button
                                    id={`btn-create-intervention-${s.userId}`}
                                    onClick={() => { setCreating(s.userId); setRiskScoreId(s.userId); }}
                                    className="btn-primary text-xs px-3 py-1.5"
                                >
                                    + Intervention
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Pending tab */}
            {tab === 'pending' && (
                <div className="space-y-4">
                    {pending.length === 0 && <p className="text-center text-slate-500 py-12 text-sm">No pending interventions.</p>}
                    {pending.map(iv => (
                        <div key={iv.id} className="card">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <p className="font-medium text-slate-700">{iv.student.email}</p>
                                    <p className="text-xs text-slate-500">{iv.student.rollNumber}</p>
                                </div>
                                <span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs rounded-full border border-amber-500/30">
                                    Pending HoD
                                </span>
                            </div>
                            <InterventionTimeline
                                createdAt={iv.createdAt}
                                sentAt={iv.sentAt}
                                seenAt={iv.seenAt}
                                status={iv.status}
                                outcome={iv.outcome}
                                aiPlan={iv.aiPlan}
                                finalPlan={iv.finalPlan}
                                educatorNote={iv.educatorNote}
                            />
                        </div>
                    ))}
                </div>
            )}

            {/* Create Intervention Modal */}
            {creating && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-800/40 backdrop-blur-sm">
                    <div className="card w-full max-w-lg mx-4 space-y-4">
                        <h2 className="text-lg font-bold text-slate-800">Create Intervention</h2>
                        <p className="text-sm text-slate-500">Student ID: {creating.slice(-12)}</p>

                        <div>
                            <label className="input-label">Risk Score ID (from cohort)</label>
                            <input value={riskScoreId} onChange={e => setRiskScoreId(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" placeholder="Paste riskScoreId here" />
                        </div>
                        <div>
                            <label className="input-label">Your Note (optional)</label>
                            <textarea value={educatorNote} onChange={e => setEducatorNote(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 min-h-[80px]" placeholder="Add context or specific concerns…" />
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={aiDraft} onChange={e => setAiDraft(e.target.checked)}
                                className="rounded" />
                            <span className="text-sm text-slate-600">Generate AI draft plan (Gemini)</span>
                        </label>
                        <div className="flex gap-3 pt-2">
                            <button onClick={handleCreateIntervention} disabled={submitting || !riskScoreId}
                                className="btn-primary flex-1 disabled:opacity-50">
                                {submitting ? 'Creating…' : 'Create & Submit for Review'}
                            </button>
                            <button onClick={() => setCreating(null)} className="btn flex-1">Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}




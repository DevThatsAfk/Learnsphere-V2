/**
 * HoDPortal.tsx — Head of Department portal.
 * Route: /hod/dashboard
 *
 * Shows: Department summary (RED/AMBER/GREEN counts), subject failure heatmap,
 * intervention approval queue, threshold config, NAAC report export.
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { InterventionTimeline } from '../components/InterventionTimeline';
import type { InterventionTimelineProps } from '../components/InterventionTimeline';

interface DeptSummary {
    total: number;
    red: number;
    amber: number;
    green: number;
    students: { id: string; email: string; rollNumber?: string | null; riskScores: { score: number; level: 'RED' | 'AMBER' | 'GREEN' }[] }[];
}

interface HeatmapEntry {
    subjectId: string;
    name: string;
    total: number;
    below40: number;
    below50: number;
    avgMarks: number;
}

interface PendingIntervention {
    id: string;
    status: InterventionTimelineProps['status'];
    createdAt: string;
    sentAt?: string | null;
    seenAt?: string | null;
    finalPlan?: string | null;
    aiPlan?: string | null;
    educatorNote?: string | null;
    student: { id: string; email: string; rollNumber?: string | null };
    educator: { id: string; email: string };
    outcome?: { deltaScore?: number | null; resolvedAt?: string; studentFeedback?: string | null } | null;
}

export default function HoDPortal() {
    const [dept, setDept] = useState<DeptSummary | null>(null);
    const [heatmap, setHeatmap] = useState<HeatmapEntry[]>([]);
    const [pending, setPending] = useState<PendingIntervention[]>([]);
    const [tab, setTab] = useState<'overview' | 'heatmap' | 'queue'>('overview');
    const [selectedIntervention, setSelectedIntervention] = useState<string | null>(null);
    const [finalPlan, setFinalPlan] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const { token: authToken } = useAuth(); const token = authToken ?? '';
    const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const fetchData = useCallback(async () => {
        const [dRes, hRes, pRes] = await Promise.all([
            fetch('/api/hod/department', { headers: authHeaders }),
            fetch('/api/hod/heatmap', { headers: authHeaders }),
            fetch('/api/hod/interventions/pending', { headers: authHeaders }),
        ]);
        if (dRes.ok) setDept(await dRes.json());
        if (hRes.ok) setHeatmap(await hRes.json());
        if (pRes.ok) setPending(await pRes.json());
    }, [token]);

    useEffect(() => { fetchData(); }, [fetchData]);

    async function handleApprove(id: string, plan?: string) {
        setSubmitting(true);
        try {
            await fetch(`/api/interventions/${id}/approve`, {
                method: 'PATCH',
                headers: authHeaders,
                body: JSON.stringify({ finalPlan: plan || undefined }),
            });
            setSelectedIntervention(null);
            setFinalPlan('');
            await fetchData();
        } finally {
            setSubmitting(false);
        }
    }

    async function handleDismiss(id: string) {
        await fetch(`/api/interventions/${id}/dismiss`, { method: 'PATCH', headers: authHeaders });
        await fetchData();
    }

    function downloadNaacReport() {
        if (!dept) return;
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
        const riskPct = dept.total > 0 ? ((dept.red + dept.amber) / dept.total * 100).toFixed(1) : '0';

        const subjectRows = heatmap.map(h => `
            <tr>
                <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${h.name}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center">${h.total}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center">${h.avgMarks.toFixed(1)}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;color:${h.below40 > 0 ? '#dc2626' : '#16a34a'}">${h.below40}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;color:${h.below50 > 0 ? '#d97706' : '#16a34a'}">${h.below50}</td>
            </tr>`).join('');

        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8"/>
    <title>NAAC Academic Risk Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; color: #1e293b; }
        h1 { color: #4f46e5; }
        .meta { color: #64748b; font-size: 13px; margin-bottom: 24px; }
        .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 24px 0; }
        .stat { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; text-align: center; }
        .stat .val { font-size: 28px; font-weight: bold; }
        .red { color: #dc2626; } .amber { color: #d97706; } .green { color: #16a34a; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th { background: #f1f5f9; padding: 10px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #64748b; }
        @media print { body { margin: 20px; } }
    </style>
</head>
<body>
    <h1>NAAC Academic Risk Report</h1>
    <div class="meta">
        <strong>Generated:</strong> ${dateStr}&nbsp;&nbsp;
        <strong>Academic Year:</strong> ${now.getFullYear()}–${now.getFullYear() + 1}&nbsp;&nbsp;
        <strong>Report Type:</strong> Institutional Academic Risk Assessment
    </div>

    <h2>Department Risk Summary</h2>
    <div class="stat-grid">
        <div class="stat"><div class="val">${dept.total}</div><div>Total Students</div></div>
        <div class="stat"><div class="val red">${dept.red}</div><div>High Risk (RED)</div></div>
        <div class="stat"><div class="val amber">${dept.amber}</div><div>At Risk (AMBER)</div></div>
        <div class="stat"><div class="val green">${dept.green}</div><div>On Track (GREEN)</div></div>
    </div>
    <p><strong>${riskPct}%</strong> of students are currently flagged at AMBER or RED risk level.</p>
    <p>Total active interventions in pipeline: <strong>${pending.length}</strong></p>

    <h2 style="margin-top:32px">Subject-wise Academic Performance Heatmap</h2>
    ${heatmap.length === 0 ? '<p>No subject data available.</p>' : `
    <table>
        <thead>
            <tr>
                <th>Subject</th>
                <th style="text-align:center">Students</th>
                <th style="text-align:center">Avg Marks</th>
                <th style="text-align:center">Below 40%</th>
                <th style="text-align:center">Below 50%</th>
            </tr>
        </thead>
        <tbody>${subjectRows}</tbody>
    </table>`}

    <p style="margin-top:40px;font-size:12px;color:#94a3b8">
        This report is auto-generated by the LearnSphere Academic Risk Platform.<br/>
        For official NAAC accreditation submission, ensure this report is signed by the Head of Department.
    </p>
</body>
</html>`;

        const win = window.open('', '_blank');
        if (win) {
            win.document.write(html);
            win.document.close();
            win.focus();
            setTimeout(() => win.print(), 500);
        }
    }

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            <div>
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">HoD Dashboard</h1>
                        <p className="text-sm text-slate-500 mt-1">Department-wide risk overview, subject analytics, and intervention queue.</p>
                    </div>
                    {/* NAAC Report Download */}
                    <button
                        id="btn-download-naac"
                        onClick={downloadNaacReport}
                        disabled={!dept}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 shrink-0"
                    >
                        📄 Download NAAC Report
                    </button>
                </div>
            </div>

            {/* Stat summary */}
            {dept && (
                <div className="grid grid-cols-4 gap-4">
                    {[
                        { label: 'Total Students', value: dept.total, color: 'text-slate-700' },
                        { label: 'RED Risk', value: dept.red, color: 'text-red-400' },
                        { label: 'AMBER Risk', value: dept.amber, color: 'text-amber-400' },
                        { label: 'On Track', value: dept.green, color: 'text-green-400' },
                    ].map(s => (
                        <div key={s.label} className="card text-center">
                            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                            <p className="text-xs text-slate-500 mt-1">{s.label}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2">
                {(['overview', 'heatmap', 'queue'] as const).map(t => (
                    <button key={t} onClick={() => setTab(t)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors capitalize ${tab === t ? 'bg-indigo-500 text-white' : 'text-slate-500 hover:text-slate-700'}`}>
                        {t === 'queue' ? `Approval Queue (${pending.length})` : t === 'heatmap' ? 'Subject Heatmap' : 'Student Overview'}
                    </button>
                ))}
            </div>

            {/* Overview tab */}
            {tab === 'overview' && dept && (
                <div className="space-y-3">
                    {dept.students.filter(s => (s.riskScores[0]?.level ?? 'GREEN') !== 'GREEN').map(s => {
                        const risk = s.riskScores[0];
                        return (
                            <div key={s.id} className="card flex items-center gap-4">
                                <div className={`w-2 h-10 rounded-full shrink-0 ${risk?.level === 'RED' ? 'bg-red-500' : 'bg-amber-500'}`} />
                                <div className="min-w-0 flex-1">
                                    <p className="font-medium text-slate-700 truncate">{s.email}</p>
                                    <p className="text-xs text-slate-500">{s.rollNumber ?? '—'}</p>
                                </div>
                                {risk && (
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${risk.level === 'RED' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                                        }`}>
                                        {risk.score.toFixed(1)} {risk.level}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                    {dept.students.filter(s => (s.riskScores[0]?.level ?? 'GREEN') !== 'GREEN').length === 0 && (
                        <p className="text-center text-slate-500 py-12 text-sm">No at-risk students. 🎉</p>
                    )}
                </div>
            )}

            {/* Heatmap tab */}
            {tab === 'heatmap' && (
                <div className="card">
                    <p className="text-sm font-semibold text-slate-700 mb-4">Subject Failure Rate (Below 40%)</p>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={heatmap} margin={{ left: -10 }}>
                            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} angle={-30} textAnchor="end" height={60} />
                            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                            <Tooltip
                                contentStyle={{ background: '#ffffff', border: '1px solid #e4e8f4', borderRadius: 8, color: '#1e293b' }}
                                formatter={(v) => [`${v ?? 0}`, 'Students']}
                            />
                            <Bar dataKey="below40" radius={[4, 4, 0, 0]}>
                                {heatmap.map((entry, idx) => (
                                    <Cell key={idx} fill={entry.below40 > 5 ? '#ef4444' : entry.below40 > 2 ? '#f59e0b' : '#22c5e'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-4 overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="text-slate-500 border-b border-slate-200">
                                    <th className="text-left py-2">Subject</th>
                                    <th className="text-right py-2">Total</th>
                                    <th className="text-right py-2">Avg %</th>
                                    <th className="text-right py-2">&lt;40</th>
                                    <th className="text-right py-2">&lt;50</th>
                                </tr>
                            </thead>
                            <tbody>
                                {heatmap.map(h => (
                                    <tr key={h.subjectId} className="border-b border-slate-100 text-slate-600">
                                        <td className="py-2">{h.name}</td>
                                        <td className="text-right">{h.total}</td>
                                        <td className={`text-right ${h.avgMarks < 50 ? 'text-red-400' : h.avgMarks < 65 ? 'text-amber-400' : 'text-green-400'}`}>{h.avgMarks}</td>
                                        <td className="text-right text-red-400">{h.below40}</td>
                                        <td className="text-right text-amber-400">{h.below50}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Approval queue */}
            {tab === 'queue' && (
                <div className="space-y-4">
                    {pending.length === 0 && <p className="text-center text-slate-500 py-12 text-sm">Queue clear. All interventions reviewed.</p>}
                    {pending.map(iv => (
                        <div key={iv.id} className="card space-y-4">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="font-medium text-slate-700">{iv.student.email}</p>
                                    <p className="text-xs text-slate-500">Created by {iv.educator.email}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setSelectedIntervention(iv.id)}
                                        className="btn-primary text-xs px-3 py-1.5">Approve / Modify</button>
                                    <button onClick={() => handleDismiss(iv.id)}
                                        className="btn text-xs px-3 py-1.5">Dismiss</button>
                                </div>
                            </div>
                            <InterventionTimeline
                                createdAt={iv.createdAt} sentAt={iv.sentAt} seenAt={iv.seenAt}
                                status={iv.status} outcome={iv.outcome} aiPlan={iv.aiPlan}
                                finalPlan={iv.finalPlan} educatorNote={iv.educatorNote}
                            />
                        </div>
                    ))}
                </div>
            )}

            {/* Approve modal */}
            {selectedIntervention && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-800/40 backdrop-blur-sm">
                    <div className="card w-full max-w-lg mx-4 space-y-4">
                        <h2 className="text-lg font-bold text-slate-800">Approve Intervention</h2>
                        <p className="text-sm text-slate-500">Leave blank to approve as-is, or modify the plan below before sending.</p>
                        <textarea value={finalPlan} onChange={e => setFinalPlan(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 min-h-[120px]" placeholder="Optionally modify the educator's plan…" />
                        <div className="flex gap-3">
                            <button onClick={() => handleApprove(selectedIntervention, finalPlan)} disabled={submitting}
                                className="btn-primary flex-1 disabled:opacity-50">
                                {submitting ? 'Sending…' : finalPlan ? 'Modify & Send' : 'Approve & Send'}
                            </button>
                            <button onClick={() => setSelectedIntervention(null)} className="btn flex-1">Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}




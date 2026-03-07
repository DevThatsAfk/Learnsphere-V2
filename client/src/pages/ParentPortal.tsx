/**
 * ParentPortal.tsx — Parent's children risk summary page.
 * Route: /parent/dashboard
 *
 * Shows: children list, risk badges, attendance %, active alerts, chat button.
 */
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useParams } from 'react-router-dom';
import { RiskScoreCard } from '../components/RiskScoreCard';

interface Child {
    id: string;
    email: string;
    rollNumber?: string | null;
    yearOfStudy?: number | null;
    section?: string | null;
    riskScores: {
        score: number;
        level: 'GREEN' | 'AMBER' | 'RED';
        calculatedAt: string;
    }[];
}

interface Alert {
    userId: string;
    score: number;
    level: 'RED' | 'AMBER';
    calculatedAt: string;
    flags: { type: string; detail: string; weight: number }[];
    user: { id: string; email: string };
}

export default function ParentPortal() {
    const [children, setChildren] = useState<Child[]>([]);
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [selectedChild, setSelectedChild] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [showReport, setShowReport] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const { childId: urlChildId } = useParams<{ childId: string }>();

    const { token: authToken } = useAuth(); const token = authToken ?? '';
    const headers = { Authorization: `Bearer ${token}` };

    useEffect(() => {
        async function load() {
            const [cRes, aRes] = await Promise.all([
                fetch('/api/parent/children', { headers }),
                fetch('/api/parent/alerts', { headers }),
            ]);
            if (cRes.ok) {
                const kids: Child[] = await cRes.json();
                setChildren(kids);
                // If URL has a childId, pre-select that child
                if (urlChildId && kids.some(k => k.id === urlChildId)) {
                    setSelectedChild(urlChildId);
                } else if (kids.length > 0 && !selectedChild) {
                    setSelectedChild(kids[0].id);
                }
            }
            if (aRes.ok) setAlerts(await aRes.json());
            setLoading(false);
        }
        load();
    }, [urlChildId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    const activeChild = children.find(c => c.id === selectedChild);
    const latestRisk = activeChild?.riskScores?.[0];
    const childAlerts = alerts.filter(a => a.user.id === selectedChild);

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Parent Portal</h1>
                <p className="text-sm text-slate-500 mt-1">Monitor your children's academic health in real-time.</p>
            </div>

            {/* Active Alerts Banner */}
            {childAlerts.length > 0 && (
                <div className="card border border-red-500/30 bg-red-500/10 space-y-2">
                    <p className="text-sm font-semibold text-red-400 flex items-center gap-2">
                        🔴 {childAlerts.length} active risk alert{childAlerts.length > 1 ? 's' : ''}
                    </p>
                    {childAlerts.slice(0, 2).map((a, i) => (
                        <p key={i} className="text-xs text-slate-600">{a.flags[0]?.detail}</p>
                    ))}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Children List */}
                <div className="space-y-3">
                    <p className="text-xs text-slate-500 uppercase tracking-wider">My Children</p>
                    {children.length === 0 ? (
                        <p className="text-sm text-slate-500">No children linked. Contact your institution admin.</p>
                    ) : (
                        children.map(child => {
                            const risk = child.riskScores?.[0];
                            return (
                                <button
                                    key={child.id}
                                    onClick={() => setSelectedChild(child.id)}
                                    className={`w-full text-left p-4 rounded-xl border transition-all ${selectedChild === child.id
                                        ? 'bg-indigo-50 border-indigo-200'
                                        : 'bg-white border-slate-200 hover:border-slate-600'
                                        }`}
                                >
                                    <p className="font-medium text-slate-700 text-sm truncate">{child.email}</p>
                                    {child.rollNumber && <p className="text-xs text-slate-500">{child.rollNumber}</p>}
                                    {risk && (
                                        <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-semibold ${risk.level === 'RED' ? 'bg-red-500/20 text-red-400' :
                                            risk.level === 'AMBER' ? 'bg-amber-500/20 text-amber-400' :
                                                'bg-green-500/20 text-green-400'
                                            }`}>
                                            {risk.level === 'RED' ? '🔴' : risk.level === 'AMBER' ? '🟡' : '✅'} {risk.level}
                                        </span>
                                    )}
                                </button>
                            );
                        })
                    )}
                </div>

                {/* Right panel */}
                <div className="lg:col-span-2 space-y-6">
                    {activeChild && latestRisk ? (
                        <>
                            <RiskScoreCard
                                score={latestRisk.score}
                                level={latestRisk.level}
                                calculatedAt={latestRisk.calculatedAt}
                                compact
                            />
                            <div className="flex gap-3">
                                <button
                                    id="btn-view-detail"
                                    onClick={() => { setShowReport(r => !r); setShowChat(false); }}
                                    className="btn-primary text-sm"
                                >
                                    {showReport ? '✕ Close Report' : '📄 View Full Report'}
                                </button>
                                <button
                                    id="btn-open-chat"
                                    onClick={() => { setShowChat(c => !c); setShowReport(false); }}
                                    className="btn text-sm"
                                >
                                    💬 {showChat ? 'Close' : 'Message Advisor'}
                                </button>
                            </div>

                            {/* Expanded Risk Report */}
                            {showReport && (
                                <div className="card border border-indigo-100 space-y-3">
                                    <p className="text-sm font-semibold text-slate-700">📊 Detailed Risk Report — {activeChild.email}</p>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="bg-slate-50 rounded-lg px-3 py-2">
                                            <p className="text-slate-400 uppercase tracking-wider mb-0.5">Risk Score</p>
                                            <p className="font-bold text-slate-700 text-lg">{latestRisk.score.toFixed(1)}</p>
                                        </div>
                                        <div className="bg-slate-50 rounded-lg px-3 py-2">
                                            <p className="text-slate-400 uppercase tracking-wider mb-0.5">Risk Level</p>
                                            <p className={`font-bold text-lg ${latestRisk.level === 'RED' ? 'text-red-500' : latestRisk.level === 'AMBER' ? 'text-amber-500' : 'text-green-500'}`}>
                                                {latestRisk.level}
                                            </p>
                                        </div>
                                    </div>
                                    {childAlerts.length > 0 && (
                                        <div>
                                            <p className="text-xs font-semibold text-slate-600 mb-1">Active Alerts</p>
                                            {childAlerts[0].flags.map((f, i) => (
                                                <div key={i} className="flex items-start gap-2 text-xs text-slate-600 py-1 border-b border-slate-100 last:border-0">
                                                    <span className="text-amber-500 shrink-0">⚠️</span>
                                                    <span>{f.detail}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <p className="text-xs text-slate-400">Last updated: {new Date(latestRisk.calculatedAt).toLocaleDateString()}</p>
                                </div>
                            )}

                            {/* Contact Advisor */}
                            {showChat && (
                                <div className="card border border-indigo-100">
                                    <p className="text-sm font-semibold text-slate-700 mb-2">💬 Contact Your Child's Advisor</p>
                                    <p className="text-sm text-slate-500 mb-3">
                                        To discuss your child's academic progress, please contact the institution's advisor portal or reach out through the official communication channels.
                                    </p>
                                    <p className="text-xs text-slate-400 bg-indigo-50 rounded-xl px-3 py-2">
                                        📌 Your child's advisor has been notified of any flagged risks. They will reach out if urgent intervention is needed.
                                    </p>
                                </div>
                            )}
                        </>
                    ) : activeChild ? (
                        <div className="card text-center py-12">
                            <p className="text-slate-500 text-sm">No risk data calculated yet for this student.</p>
                        </div>
                    ) : (
                        <div className="card text-center py-12">
                            <p className="text-slate-500 text-sm">Select a child to view their report.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}





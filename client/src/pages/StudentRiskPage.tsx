/**
 * StudentRiskPage.tsx — Student's personal risk dashboard.
 *
 * Shows: Current risk card, trigger recalculate, intervention inbox, history chart.
 * Route: /risk (for STUDENT role only)
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { BASE_URL } from '../lib/api';
import { RiskScoreCard } from '../components/RiskScoreCard';
import { InterventionTimeline } from '../components/InterventionTimeline';
import type { RiskScoreCardProps } from '../components/RiskScoreCard';
import type { InterventionTimelineProps } from '../components/InterventionTimeline';

interface RiskData extends Omit<RiskScoreCardProps, 'compact'> {
    id: string;
    calculatedAt: string;
    flags: { type: string; detail: string; weight: number }[];
    dimensions: {
        attendance: number;
        marks: number;
        study_activity: number;
        lms_activity: number;
        recall: number;
        behavioural: number;
    };
    aiExplanation: string;
    predictedTrajectory: string;
}

interface Intervention {
    id: string;
    status: InterventionTimelineProps['status'];
    createdAt: string;
    sentAt?: string | null;
    seenAt?: string | null;
    finalPlan?: string | null;
    aiPlan?: string | null;
    educatorNote?: string | null;
    outcome?: { deltaScore?: number | null; resolvedAt?: string; studentFeedback?: string | null } | null;
}

export default function StudentRiskPage() {
    const [risk, setRisk] = useState<RiskData | null>(null);
    const [interventions, setInterventions] = useState<Intervention[]>([]);
    const [loading, setLoading] = useState(true);
    const [calculating, setCalculating] = useState(false);

    const { token: authToken } = useAuth(); const token = authToken ?? '';
    const headers = { Authorization: `Bearer ${token}` };

    const fetchRisk = useCallback(async () => {
        try {
            const [rRes, iRes] = await Promise.all([
                fetch(`${BASE_URL}/risk/me`, { headers }),
                fetch(`${BASE_URL}/interventions/mine`, { headers }),
            ]);
            if (rRes.ok) {
                const data = await rRes.json();
                setRisk(data.score !== undefined ? null : data); // 'null message' = no score yet
                if (data.score !== undefined) setRisk(data);
            }
            if (iRes.ok) setInterventions(await iRes.json());
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchRisk(); }, [fetchRisk]);

    async function handleCalculate() {
        setCalculating(true);
        try {
            const res = await fetch(`${BASE_URL}/risk/me/calculate`, { method: 'POST', headers });
            const data = await res.json();
            setRisk(data);
        } finally {
            setCalculating(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">My Academic Risk</h1>
                    <p className="text-sm text-slate-500 mt-1">Track your performance health and open interventions.</p>
                </div>
                <button
                    id="btn-calculate-risk"
                    onClick={handleCalculate}
                    disabled={calculating}
                    className="btn-primary flex items-center gap-2 disabled:opacity-50"
                >
                    {calculating && <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />}
                    {calculating ? 'Calculating…' : '↺ Recalculate'}
                </button>
            </div>

            {/* Risk Card */}
            {!risk ? (
                <div className="card text-center py-12">
                    <p className="text-slate-400 mb-4">No risk score calculated yet.</p>
                    <button onClick={handleCalculate} className="btn-primary" disabled={calculating}>
                        {calculating ? 'Calculating…' : 'Calculate Now'}
                    </button>
                </div>
            ) : (
                <>
                    <RiskScoreCard
                        score={risk.score}
                        level={risk.level}
                        dimensions={risk.dimensions}
                        flags={risk.flags}
                        aiExplanation={risk.aiExplanation}
                        calculatedAt={risk.calculatedAt}
                    />

                    {/* Trajectory */}
                    {risk.predictedTrajectory && (
                        <div className="card">
                            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">4-Week Outlook</p>
                            <p className="text-sm text-slate-600 leading-relaxed">{risk.predictedTrajectory}</p>
                        </div>
                    )}
                </>
            )}

            {/* Intervention Inbox */}
            <div>
                <h2 className="text-lg font-semibold text-slate-700 mb-4">Intervention Plans</h2>
                {interventions.length === 0 ? (
                    <div className="card text-center py-8 text-slate-500 text-sm">No intervention plans yet. Keep up the good work! 🎉</div>
                ) : (
                    <div className="space-y-4">
                        {interventions.map(iv => (
                            <div key={iv.id} className="card">
                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-4">Intervention #{iv.id.slice(-8)}</p>
                                <InterventionTimeline
                                    createdAt={iv.createdAt}
                                    sentAt={iv.sentAt}
                                    seenAt={iv.seenAt}
                                    status={iv.status}
                                    outcome={iv.outcome}
                                    finalPlan={iv.finalPlan}
                                    aiPlan={iv.aiPlan}
                                    educatorNote={iv.educatorNote}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}




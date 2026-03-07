/**
 * RiskScoreCard.tsx — Reusable risk score display component.
 * Shows score, level badge (GREEN/AMBER/RED), 6 dimension bars, top flags.
 * Used across Student, Advisor, HoD, and Admin dashboards.
 */
import { RadialBarChart, RadialBar, ResponsiveContainer, Tooltip } from 'recharts';

export interface RiskDimensions {
    attendance: number;
    marks: number;
    study_activity: number;
    lms_activity: number;
    recall: number;
    behavioural: number;
}

export interface RiskFlag {
    type: string;
    detail: string;
    weight: number;
}

export interface RiskScoreCardProps {
    score: number;
    level: 'GREEN' | 'AMBER' | 'RED';
    dimensions?: RiskDimensions;
    flags?: RiskFlag[];
    aiExplanation?: string;
    calculatedAt?: string;
    compact?: boolean; // compact mode: no dimension bars, just badge
}

const LEVEL_META = {
    GREEN: {
        label: 'On Track',
        bg: 'bg-green-500/10 border-green-500/30',
        badge: 'bg-green-500/20 text-green-400 border border-green-500/30',
        ring: 'text-green-400',
        bar: '#22c55e',
        emoji: '✅',
    },
    AMBER: {
        label: 'Needs Attention',
        bg: 'bg-amber-500/10 border-amber-500/30',
        badge: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
        ring: 'text-amber-400',
        bar: '#f59e0b',
        emoji: '⚠️',
    },
    RED: {
        label: 'Urgent Intervention',
        bg: 'bg-red-500/10 border-red-500/30',
        badge: 'bg-red-500/20 text-red-400 border border-red-500/30',
        ring: 'text-red-400',
        bar: '#ef4444',
        emoji: '🔴',
    },
};

const DIM_LABELS: Record<string, string> = {
    attendance: 'Attendance',
    marks: 'Marks',
    study_activity: 'Study Activity',
    lms_activity: 'LMS Activity',
    recall: 'Recall Strength',
    behavioural: 'Behavioural',
};

function DimensionBar({ label, score, color }: { label: string; score: number; color: string }) {
    return (
        <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 w-28 shrink-0">{label}</span>
            <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, score)}%`, background: color }}
                />
            </div>
            <span className="text-xs font-mono text-slate-300 w-8 text-right">{Math.round(score)}</span>
        </div>
    );
}

export function RiskScoreCard({
    score,
    level,
    dimensions,
    flags,
    aiExplanation,
    calculatedAt,
    compact = false,
}: RiskScoreCardProps) {
    const meta = LEVEL_META[level];
    const chartData = [{ name: 'Risk', value: score, fill: meta.bar }];

    return (
        <div className={`card border ${meta.bg} transition-all`}>
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div>
                    <p className="text-xs text-muted uppercase tracking-wider mb-1">Risk Score</p>
                    <p className={`text-4xl font-bold font-mono ${meta.ring}`}>
                        {score.toFixed(1)}
                        <span className="text-lg text-muted font-normal">/100</span>
                    </p>
                    {calculatedAt && (
                        <p className="text-xs text-muted mt-1">
                            Calculated {new Date(calculatedAt).toLocaleString()}
                        </p>
                    )}
                </div>

                {/* Radial gauge */}
                <div className="w-24 h-24">
                    <ResponsiveContainer width="100%" height="100%">
                        <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="100%"
                            data={chartData} startAngle={180} endAngle={0}>
                            <RadialBar background dataKey="value" cornerRadius={6} />
                            <Tooltip formatter={(v: number | undefined) => [`${(v ?? 0).toFixed(1)}`, 'Risk']} />
                        </RadialBarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Level badge */}
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${meta.badge}`}>
                {meta.emoji} {meta.label}
            </span>

            {/* Dimension bars (full mode) */}
            {!compact && dimensions && (
                <div className="mt-5 space-y-2.5">
                    <p className="text-xs text-muted uppercase tracking-wider mb-2">Dimension Safety Scores (higher = safer)</p>
                    {Object.entries(dimensions).map(([key, val]) => (
                        <DimensionBar key={key} label={DIM_LABELS[key] ?? key} score={val} color={meta.bar} />
                    ))}
                </div>
            )}

            {/* Active flags */}
            {!compact && flags && flags.length > 0 && (
                <div className="mt-4 space-y-2">
                    <p className="text-xs text-muted uppercase tracking-wider">Active Risk Signals</p>
                    {flags.map((f, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                            <span className="text-amber-400 shrink-0">⚑</span>
                            <span className="text-slate-300">{f.detail}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* AI explanation */}
            {!compact && aiExplanation && (
                <div className="mt-4 p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                    <p className="text-xs text-muted uppercase tracking-wider mb-1">AI Analysis</p>
                    <p className="text-sm text-slate-300 leading-relaxed">{aiExplanation}</p>
                </div>
            )}
        </div>
    );
}

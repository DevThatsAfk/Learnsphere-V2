/**
 * InterventionTimeline.tsx — Visual evidence trail for evaluators.
 * Shows: Risk Detected → Created → Sent → Acknowledged → Outcome
 */

export type InterventionStatus =
    | 'PENDING_REVIEW' | 'APPROVED' | 'MODIFIED_SENT'
    | 'ACKNOWLEDGED' | 'COMPLETED' | 'DISMISSED';

export interface InterventionTimelineProps {
    createdAt: string;
    sentAt?: string | null;
    seenAt?: string | null;
    status: InterventionStatus;
    outcome?: { deltaScore?: number | null; resolvedAt?: string; studentFeedback?: string | null } | null;
    finalPlan?: string | null;
    aiPlan?: string | null;
    educatorNote?: string | null;
}

const STEP_META: { key: string; label: string; desc: (p: InterventionTimelineProps) => string | undefined }[] = [
    { key: 'created', label: '📋 Plan Created', desc: p => `Created ${new Date(p.createdAt).toLocaleDateString()}` },
    { key: 'sent', label: '📤 Sent to Student', desc: p => p.sentAt ? `Sent ${new Date(p.sentAt).toLocaleDateString()}` : 'Pending HoD approval' },
    { key: 'seen', label: '👁 Acknowledged by Student', desc: p => p.seenAt ? `Seen ${new Date(p.seenAt).toLocaleDateString()}` : 'Not yet viewed' },
    { key: 'outcome', label: '📊 7-Day Outcome', desc: p => p.outcome ? (p.outcome.deltaScore != null ? `Risk score change: ${p.outcome.deltaScore > 0 ? '+' : ''}${p.outcome.deltaScore?.toFixed(1)}` : 'Outcome recorded') : 'Follow-up pending' },
];

function isStepDone(key: string, p: InterventionTimelineProps): boolean {
    if (key === 'created') return true;
    if (key === 'sent') return !!p.sentAt || ['APPROVED', 'MODIFIED_SENT', 'ACKNOWLEDGED', 'COMPLETED'].includes(p.status);
    if (key === 'seen') return !!p.seenAt || ['ACKNOWLEDGED', 'COMPLETED'].includes(p.status);
    if (key === 'outcome') return !!p.outcome;
    return false;
}

export function InterventionTimeline(props: InterventionTimelineProps) {
    return (
        <div className="space-y-0">
            {STEP_META.map((step, idx) => {
                const done = isStepDone(step.key, props);
                const isLast = idx === STEP_META.length - 1;
                return (
                    <div key={step.key} className="flex gap-4">
                        {/* Dot + line */}
                        <div className="flex flex-col items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 transition-all ${done ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30' : 'bg-slate-700 text-muted border border-slate-600'
                                }`}>
                                {done ? '✓' : '○'}
                            </div>
                            {!isLast && (
                                <div className={`w-0.5 flex-1 min-h-[24px] mt-1 transition-colors ${done ? 'bg-indigo-500/40' : 'bg-slate-700'}`} />
                            )}
                        </div>
                        {/* Content */}
                        <div className={`pb-5 min-w-0 ${isLast ? '' : ''}`}>
                            <p className={`text-sm font-semibold ${done ? 'text-slate-200' : 'text-muted'}`}>{step.label}</p>
                            <p className="text-xs text-muted mt-0.5">{step.desc(props)}</p>
                            {/* Outcome details */}
                            {step.key === 'outcome' && props.outcome?.studentFeedback && (
                                <p className="text-xs text-slate-400 mt-1 italic">"{props.outcome.studentFeedback}"</p>
                            )}
                        </div>
                    </div>
                );
            })}

            {/* Plan preview */}
            {(props.finalPlan || props.aiPlan) && (
                <div className="mt-2 p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                    <p className="text-xs text-muted uppercase tracking-wider mb-1">
                        {props.finalPlan ? 'Final Plan (HoD Modified)' : 'AI Draft Plan'}
                    </p>
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line line-clamp-4">
                        {props.finalPlan ?? props.aiPlan}
                    </p>
                </div>
            )}
        </div>
    );
}

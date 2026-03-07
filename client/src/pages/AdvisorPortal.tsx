/**
 * AdvisorPortal.tsx — Academic advisor's caseload dashboard.
 * Route: /advisor/dashboard
 *
 * Shows: Assigned students sorted by risk level, full student view with
 * risk history, counselling notes, and chat.
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { RiskScoreCard } from '../components/RiskScoreCard';
import { ChatWidget } from '../components/ChatWidget';
import { InterventionTimeline } from '../components/InterventionTimeline';
import type { InterventionTimelineProps } from '../components/InterventionTimeline';

interface AssignedStudent {
    id: string;
    email: string;
    rollNumber?: string | null;
    yearOfStudy?: number | null;
    section?: string | null;
    riskScores: { score: number; level: 'GREEN' | 'AMBER' | 'RED'; calculatedAt: string }[];
}

interface StudentDetail {
    studentId: string;
    riskScores: {
        id: string;
        score: number;
        level: 'GREEN' | 'AMBER' | 'RED';
        calculatedAt: string;
        attendanceScore: number;
        marksScore: number;
        studyActivityScore: number;
        lmsActivityScore: number;
        recallScore: number;
        behaviouralScore: number;
        aiExplanation?: string | null;
        flags: { type: string; detail: string; weight: number }[];
    }[];
    interventions: (Omit<InterventionTimelineProps, 'outcome'> & {
        id: string;
        outcome?: { deltaScore?: number | null; studentFeedback?: string | null; resolvedAt?: string } | null;
    })[];
    notes: { id: string; note: string; sessionAt: string }[];
}

export default function AdvisorPortal() {
    const [students, setStudents] = useState<AssignedStudent[]>([]);
    const [detail, setDetail] = useState<StudentDetail | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [tab, setTab] = useState<'risk' | 'interventions' | 'notes' | 'chat'>('risk');
    const [noteText, setNoteText] = useState('');
    const [savingNote, setSavingNote] = useState(false);

    const { token: authToken, user } = useAuth(); const token = authToken ?? '';
    const currentUserId = user?.id ?? '';
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const loadStudents = useCallback(async () => {
        const res = await fetch('/api/advisor/students', { headers });
        if (res.ok) {
            const data: AssignedStudent[] = await res.json();
            setStudents(data);
            if (data.length > 0 && !selectedId) selectStudent(data[0].id);
        }
    }, [token]);

    useEffect(() => { loadStudents(); }, [loadStudents]);

    const selectStudent = useCallback(async (studentId: string) => {
        setSelectedId(studentId);
        const res = await fetch(`/api/advisor/students/${studentId}`, { headers });
        if (res.ok) setDetail(await res.json());
    }, [token]);

    async function handleSaveNote() {
        if (!noteText.trim() || !selectedId) return;
        setSavingNote(true);
        try {
            await fetch('/api/advisor/notes', {
                method: 'POST',
                headers,
                body: JSON.stringify({ studentId: selectedId, note: noteText.trim(), sessionAt: new Date().toISOString() }),
            });
            setNoteText('');
            selectStudent(selectedId);
        } finally {
            setSavingNote(false);
        }
    }

    const activeStudent = students.find(s => s.id === selectedId);
    const latest = detail?.riskScores?.[0];

    return (
        <div className="flex gap-6 max-w-6xl mx-auto" style={{ minHeight: 'calc(100vh - 120px)' }}>
            {/* Sidebar */}
            <div className="w-72 shrink-0 space-y-2">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">My Caseload ({students.length})</p>
                {students.map(s => {
                    const risk = s.riskScores?.[0];
                    const isSelected = s.id === selectedId;
                    return (
                        <button key={s.id} onClick={() => selectStudent(s.id)}
                            className={`w-full text-left p-3 rounded-xl border transition-all ${isSelected ? 'bg-indigo-500/10 border-indigo-500/40' : 'bg-white border-slate-200 hover:border-slate-600'}`}>
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-slate-700 truncate">{s.email}</p>
                                {risk && (
                                    <span className={`w-2 h-2 rounded-full shrink-0 ${risk.level === 'RED' ? 'bg-red-500' : risk.level === 'AMBER' ? 'bg-amber-500' : 'bg-green-500'}`} />
                                )}
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">{s.rollNumber ?? '—'} {s.section ? `· Sec ${s.section}` : ''}</p>
                        </button>
                    );
                })}
                {students.length === 0 && (
                    <p className="text-sm text-slate-500">No students assigned. Contact your admin.</p>
                )}
            </div>

            {/* Main panel */}
            <div className="flex-1 min-w-0 space-y-5">
                {activeStudent && detail ? (
                    <>
                        <div>
                            <h1 className="text-xl font-bold text-slate-800">{activeStudent.email}</h1>
                            <p className="text-sm text-slate-500 mt-0.5">{activeStudent.rollNumber} · Year {activeStudent.yearOfStudy} · Section {activeStudent.section}</p>
                        </div>

                        {/* Sub-tabs */}
                        <div className="flex gap-2 flex-wrap">
                            {(['risk', 'interventions', 'notes', 'chat'] as const).map(t => (
                                <button key={t} onClick={() => setTab(t)}
                                    className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-indigo-500 text-white' : 'text-slate-500 hover:text-slate-700'}`}>
                                    {t === 'chat' ? '💬 Chat' : t === 'notes' ? '📝 Notes' : t === 'interventions' ? '🛡️ Interventions' : '📊 Risk'}
                                </button>
                            ))}
                        </div>

                        {/* Interventions tab */}
                        {tab === 'interventions' && (
                            <div className="space-y-4">
                                {detail?.interventions?.length === 0 && (
                                    <p className="text-sm text-slate-500 text-center py-8">No interventions for this student yet.</p>
                                )}
                                {detail?.interventions?.map((iv, i) => (
                                    <div key={iv.id} className="card border border-slate-200">
                                        <div className="flex items-center justify-between mb-3">
                                            <p className="text-xs font-semibold text-slate-500 uppercase">Intervention #{i + 1}</p>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${iv.status === 'COMPLETED' ? 'bg-green-50 text-green-700 border-green-200' :
                                                    iv.status === 'MODIFIED_SENT' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                        iv.status === 'ACKNOWLEDGED' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                                            'bg-amber-50 text-amber-700 border-amber-200'
                                                }`}>{iv.status.replace('_', ' ')}</span>
                                        </div>
                                        {/* Timeline */}
                                        <div className="flex gap-4 text-xs text-slate-500 mb-3">
                                            <span>📅 Created: {new Date(iv.createdAt).toLocaleDateString()}</span>
                                            {iv.sentAt && <span>📤 Sent: {new Date(iv.sentAt).toLocaleDateString()}</span>}
                                            {iv.seenAt && <span>👁️ Seen: {new Date(iv.seenAt).toLocaleDateString()}</span>}
                                        </div>
                                        {/* Plans */}
                                        {iv.educatorNote && (
                                            <div className="mb-2">
                                                <p className="text-xs font-semibold text-slate-600 mb-1">Educator Note</p>
                                                <p className="text-sm text-slate-600 bg-slate-50 rounded-xl px-3 py-2">{iv.educatorNote}</p>
                                            </div>
                                        )}
                                        {iv.finalPlan && (
                                            <div className="mb-2">
                                                <p className="text-xs font-semibold text-slate-600 mb-1">Final Plan</p>
                                                <p className="text-sm text-slate-600 bg-indigo-50 rounded-xl px-3 py-2 whitespace-pre-wrap">{iv.finalPlan}</p>
                                            </div>
                                        )}
                                        {iv.outcome?.studentFeedback && (
                                            <div>
                                                <p className="text-xs font-semibold text-slate-600 mb-1">Student Feedback</p>
                                                <p className="text-sm text-slate-500 italic">"{iv.outcome.studentFeedback}"</p>
                                                {iv.outcome.deltaScore != null && (
                                                    <p className={`text-xs mt-1 font-semibold ${iv.outcome.deltaScore >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                        Score change: {iv.outcome.deltaScore >= 0 ? '+' : ''}{iv.outcome.deltaScore.toFixed(1)}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Risk tab */}
                        {tab === 'risk' && latest && (
                            <div className="space-y-4">
                                <RiskScoreCard
                                    score={latest.score}
                                    level={latest.level}
                                    calculatedAt={latest.calculatedAt}
                                    dimensions={{
                                        attendance: latest.attendanceScore,
                                        marks: latest.marksScore,
                                        study_activity: latest.studyActivityScore,
                                        lms_activity: latest.lmsActivityScore,
                                        recall: latest.recallScore,
                                        behavioural: latest.behaviouralScore,
                                    }}
                                    flags={latest.flags}
                                    aiExplanation={latest.aiExplanation ?? undefined}
                                />
                                {detail.interventions.length > 0 && (
                                    <div className="card">
                                        <p className="text-xs text-slate-500 uppercase mb-3">Latest Intervention</p>
                                        <InterventionTimeline {...detail.interventions[0]} />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Notes tab */}
                        {tab === 'notes' && (
                            <div className="space-y-4">
                                {/* Add note */}
                                <div className="card space-y-3">
                                    <p className="text-sm font-semibold text-slate-700">Add Counselling Note</p>
                                    <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 min-h-[100px]"
                                        placeholder="Notes from today's session…" />
                                    <button onClick={handleSaveNote} disabled={savingNote || !noteText.trim()}
                                        className="btn-primary text-sm disabled:opacity-50">
                                        {savingNote ? 'Saving…' : 'Save Note'}
                                    </button>
                                </div>
                                {/* Notes list */}
                                <div className="space-y-3">
                                    {detail.notes.map(n => (
                                        <div key={n.id} className="card">
                                            <p className="text-xs text-slate-500 mb-1">{new Date(n.sessionAt).toLocaleDateString()}</p>
                                            <p className="text-sm text-slate-600 whitespace-pre-wrap">{n.note}</p>
                                        </div>
                                    ))}
                                    {detail.notes.length === 0 && (
                                        <p className="text-sm text-slate-500 text-center py-6">No notes yet for this student.</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Chat tab */}
                        {tab === 'chat' && (
                            <div className="h-[500px]">
                                <ChatWidget
                                    studentId={selectedId!}
                                    currentUserId={currentUserId}
                                    currentUserName="Advisor"
                                />
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex items-center justify-center h-64">
                        <p className="text-slate-500 text-sm">Select a student from the list.</p>
                    </div>
                )}
            </div>
        </div>
    );
}




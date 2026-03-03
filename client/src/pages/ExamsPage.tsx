import { useEffect, useState } from 'react';
import { examsApi, ApiError } from '../lib/api';
import { useSubjects } from '../context/SubjectsContext';
import type { Exam, ExamMark } from '../types/api';
import { FullPageSpinner, ErrorBanner, EmptyState } from '../components/ui';

export function ExamsPage() {
    const { subjects, loading: subjectsLoading } = useSubjects();

    const [exams, setExams] = useState<Exam[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Create exam form
    const [title, setTitle] = useState('');
    const [examDate, setExamDate] = useState('');
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    // Marks panel
    const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
    const [markValues, setMarkValues] = useState<Record<string, string>>({});
    const [savingMarks, setSavingMarks] = useState(false);

    async function load() {
        setLoading(true); setError(null);
        try { setExams(await examsApi.list()); }
        catch { setError('Could not load exams.'); }
        finally { setLoading(false); }
    }
    useEffect(() => { load(); }, []);

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        setCreating(true); setCreateError(null);
        try {
            const exam = await examsApi.create(title, examDate);
            setExams(prev => [...prev, exam]);
            setTitle(''); setExamDate('');
        } catch (err) {
            setCreateError(err instanceof ApiError ? err.message : 'Failed to create exam.');
        } finally { setCreating(false); }
    }

    async function openMarks(exam: Exam) {
        setSelectedExam(exam);
        const m = await examsApi.getMarks(exam.id);
        const init: Record<string, string> = {};
        subjects.forEach(s => {
            const existing = m.find(mk => mk.subject_id === s.id);
            init[s.id] = existing ? String(existing.marks) : '';
        });
        setMarkValues(init);
    }

    async function handleSaveMarks(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedExam) return;
        setSavingMarks(true);
        const payload: ExamMark[] = Object.entries(markValues)
            .filter(([, v]) => v !== '')
            .map(([subject_id, v]) => ({ subject_id, marks: parseInt(v, 10) }));
        try {
            await examsApi.addMarks(selectedExam.id, payload);
            setSelectedExam(null);
        } catch (err) {
            alert(err instanceof ApiError ? err.message : 'Failed to save marks.');
        } finally { setSavingMarks(false); }
    }

    if (subjectsLoading || loading) return <FullPageSpinner />;
    if (error) return <div className="py-8"><ErrorBanner message={error} onRetry={load} /></div>;

    return (
        <div className="animate-slide-up max-w-2xl">
            <div className="page-header"><h1>Exams</h1></div>

            {/* Create */}
            <div className="card mb-6">
                <p className="section-title">Add Exam</p>
                <form id="form-create-exam" onSubmit={handleCreate} className="flex flex-col gap-3 mt-2">
                    <input id="input-exam-title" type="text" placeholder="Exam title" value={title} onChange={e => setTitle(e.target.value)} required />
                    <input id="input-exam-date" type="date" value={examDate} onChange={e => setExamDate(e.target.value)} required className="w-full" />
                    <button id="btn-create-exam" type="submit" disabled={creating} className="btn-primary">{creating ? '…' : 'Add Exam'}</button>
                </form>
                {createError && <p className="text-xs text-amber-400 mt-2">⚠ {createError}</p>}
            </div>

            {/* List */}
            <div className="card">
                <p className="section-title">All Exams</p>
                {exams.length === 0 ? (
                    <EmptyState title="No exams yet" description="Add an upcoming exam above." />
                ) : (
                    <ul className="flex flex-col gap-2 mt-2">
                        {exams.map(ex => (
                            <li key={ex.id} className="flex items-center justify-between py-2.5 px-1 border-b border-slate-700/40 last:border-0">
                                <div>
                                    <p className="text-slate-200 font-medium">{ex.title}</p>
                                    <p className="text-muted text-xs">{ex.exam_date}</p>
                                </div>
                                <button id={`btn-marks-${ex.id}`} onClick={() => openMarks(ex)} className="btn-secondary btn-sm">
                                    Enter Marks
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Marks modal */}
            {selectedExam && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="card w-full max-w-md animate-slide-up">
                        <div className="flex items-center justify-between mb-4">
                            <h2>Marks — {selectedExam.title}</h2>
                            <button onClick={() => setSelectedExam(null)} className="btn-ghost btn-sm">✕</button>
                        </div>
                        <form id="form-save-marks" onSubmit={handleSaveMarks} className="flex flex-col gap-3">
                            {subjects.length === 0 ? (
                                <EmptyState title="No subjects" description="Add subjects to enter marks." />
                            ) : (
                                subjects.map(s => (
                                    <div key={s.id} className="flex items-center justify-between gap-3">
                                        <label htmlFor={`mark-${s.id}`} className="text-slate-300 text-sm flex-1">{s.name}</label>
                                        <input
                                            id={`mark-${s.id}`}
                                            type="number" min={0} max={100}
                                            placeholder="0–100"
                                            value={markValues[s.id] ?? ''}
                                            onChange={e => setMarkValues(prev => ({ ...prev, [s.id]: e.target.value }))}
                                            className="w-24 text-center"
                                        />
                                    </div>
                                ))
                            )}
                            <button id="btn-save-marks" type="submit" disabled={savingMarks} className="btn-primary mt-2">
                                {savingMarks ? '…' : 'Save Marks'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

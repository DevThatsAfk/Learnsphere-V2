import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { sessionsApi, reviewsApi, notesApi, generateApi, ApiError } from '../lib/api';
import { useSubjects } from '../context/SubjectsContext';
import type { SessionStartResponse, RecallStrength, AIQuizQuestion } from '../types/api';
import { FullPageSpinner, ErrorBanner, EmptyState } from '../components/ui';
import { NotesPanel } from '../components/NotesPanel';

// ─── Types ────────────────────────────────────────────────────────
type Phase = 'idle' | 'active' | 'debrief' | 'flashcards' | 'quiz' | 'reviewing';

interface DraftCard {
    id: string;          // temp local id
    question: string;
    answer: string;
    strength: RecallStrength | null;
    cardId: string | null;  // server card_id after save
    saved: boolean;
}

// Static self-assessment quiz (informational only — not stored)
const QUIZ_QUESTIONS = [
    {
        id: 'q1',
        text: 'How well did you grasp the material in this session?',
        options: ['Very well — I could explain it to someone else', 'Mostly got it — a few gaps remain', 'Struggling — needs another session'],
    },
    {
        id: 'q2',
        text: 'Did you stay on track with your planned topic?',
        options: ['Yes, fully focused', 'Partially — some distractions', 'Got sidetracked'],
    },
    {
        id: 'q3',
        text: 'When do you plan to revisit this topic?',
        options: ['Tomorrow or within 2 days', 'This week', 'I am comfortable — no rush'],
    },
];

/** Format seconds → MM:SS */
function fmt(s: number) {
    const m = Math.floor(s / 60), sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

// ─── Recall badge colours ─────────────────────────────────────────
const RECALL_STYLES: Record<RecallStrength, string> = {
    WEAK: 'bg-red-600/20 border-red-500/40 text-red-400',
    MODERATE: 'bg-amber-600/20 border-amber-500/40 text-amber-400',
    STRONG: 'bg-green-600/20 border-green-500/40 text-green-400',
};

// ─── Component ─────────────────────────────────────────────────────
export function SessionsPage() {
    // Subjects from global context — always reflects latest names
    const { subjects, loading: subjectsLoading, error: subjectsError, refreshSubjects } = useSubjects();
    const navigate = useNavigate();

    // ── Session core state ───────────────────────────────────────
    const [phase, setPhase] = useState<Phase>('idle');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [topic, setTopic] = useState('');
    const [sessionType, setSessionType] = useState<'STUDY' | 'REVISION'>('STUDY');
    const [session, setSession] = useState<SessionStartResponse | null>(null);
    const [startError, setStartError] = useState<string | null>(null);

    // ── Authoritative Timer ──────────────────────────────────────
    const [elapsed, setElapsed] = useState(0);
    const [paused, setPaused] = useState(false);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const pausedRef = useRef(false);
    pausedRef.current = paused;

    const startTick = useCallback(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            if (!pausedRef.current) setElapsed(e => e + 1);
        }, 1000);
    }, []);

    const stopTick = useCallback(() => {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }, []);

    useEffect(() => {
        if (phase === 'active') startTick(); else stopTick();
        return () => stopTick();
    }, [phase, startTick, stopTick]);

    // Pause on tab-hide / window-blur; resume on focus
    useEffect(() => {
        if (phase !== 'active') return;
        const onVis = () => { const p = document.hidden; setPaused(p); pausedRef.current = p; };
        const onBlur = () => { setPaused(true); pausedRef.current = true; };
        const onFocus = () => { setPaused(false); pausedRef.current = false; };
        document.addEventListener('visibilitychange', onVis);
        window.addEventListener('blur', onBlur);
        window.addEventListener('focus', onFocus);
        return () => {
            document.removeEventListener('visibilitychange', onVis);
            window.removeEventListener('blur', onBlur);
            window.removeEventListener('focus', onFocus);
        };
    }, [phase]);

    const elapsedMinutes = Math.max(1, Math.ceil(elapsed / 60));

    // ── End-session form ─────────────────────────────────────────
    const [activeMinutes, setActiveMinutes] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // ── Flashcard phase state ────────────────────────────────────
    const [reviewId, setReviewId] = useState<string | null>(null);
    const [cards, setCards] = useState<DraftCard[]>([]);
    const [cardQ, setCardQ] = useState('');
    const [cardA, setCardA] = useState('');
    const [savingCard, setSavingCard] = useState(false);
    const [cardError, setCardError] = useState<string | null>(null);

    // ── Quiz phase state ─────────────────────────────────────────
    const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});

    // ── Reflection phase state ───────────────────────────────────
    const [reflection, setReflection] = useState('');
    const [tags, setTags] = useState('');

    const [generating, setGenerating] = useState(false);
    const [genError, setGenError] = useState<string | null>(null);
    const [dynamicQuiz, setDynamicQuiz] = useState<AIQuizQuestion[] | null>(null);

    // Live notes text from NotesPanel — updated on every keystroke via onNotesChange callback
    const liveNotesRef = useRef<string>('');

    async function handleAiFlashcards() {
        if (!selectedSubject || !reviewId) return;
        setGenerating(true); setGenError(null);
        try {
            // 1: Use live notes the user has typed (instant, no save required)
            let notesText = liveNotesRef.current.trim();

            // 2: Fallback — fetch from API (covers previously saved notes)
            if (notesText.length < 50) {
                const list = await notesApi.list(selectedSubject, topic);
                notesText = list.map(n => n.content).join('\n\n').trim();
            }

            // 3: If still too short, load ALL notes for subject regardless of topic
            if (notesText.length < 50) {
                const allList = await notesApi.list(selectedSubject);
                notesText = allList.map(n => n.content).join('\n\n').trim();
            }

            if (notesText.length < 50) {
                setGenError('Write at least 50 chars in "My Notes" first to generate cards.');
                return;
            }
            const suggested = await generateApi.flashcards(notesText);
            for (const s of suggested) {
                if (cards.length >= 5) break;
                const card = await reviewsApi.addFlashcard(reviewId, s.question, s.answer);
                setCards(prev => [...prev, {
                    id: card.card_id,
                    cardId: card.card_id,
                    question: s.question,
                    answer: s.answer,
                    strength: null,
                    saved: true
                }]);
            }
        } catch (err) {
            setGenError(err instanceof ApiError ? err.message : 'AI Generation failed.');
        } finally {
            setGenerating(false);
        }
    }

    async function handleAiQuiz() {
        if (!selectedSubject) return;
        setGenerating(true); setGenError(null);
        try {
            // 1: Use live notes first
            let notesText = liveNotesRef.current.trim();
            // 2: Fallback to saved notes for this topic
            if (notesText.length < 50) {
                const list = await notesApi.list(selectedSubject, topic);
                notesText = list.map(n => n.content).join('\n\n').trim();
            }
            // 3: Fallback to all notes for subject
            if (notesText.length < 50) {
                const allList = await notesApi.list(selectedSubject);
                notesText = allList.map(n => n.content).join('\n\n').trim();
            }
            if (notesText.length < 50) {
                setGenError('Write at least 50 chars in "My Notes" first.');
                return;
            }
            const suggestedQuiz = await generateApi.quiz(notesText);
            setDynamicQuiz(suggestedQuiz);
        } catch (err) {
            setGenError(err instanceof ApiError ? err.message : 'AI Quiz Generation failed.');
        } finally {
            setGenerating(false);
        }
    }

    // ── Data loading ─────────────────────────────────────────────
    // subjects come from global context — no local load needed

    // Auto-select first subject
    useEffect(() => {
        if (subjects.length > 0 && !selectedSubject) setSelectedSubject(subjects[0].id);
    }, [subjects, selectedSubject]);

    // When active minutes field is needed, pre-populate from timer
    useEffect(() => {
        if (phase === 'reviewing') setActiveMinutes(String(elapsedMinutes));
    }, [phase, elapsedMinutes]);

    async function handleStart(e: React.FormEvent) {
        e.preventDefault();
        if (!topic.trim() || !selectedSubject) return;
        setStartError(null);
        try {
            const s = await sessionsApi.start(selectedSubject, topic.trim(), sessionType);
            setSession(s); setElapsed(0); setPaused(false);
            pausedRef.current = false;
            setPhase('active');
        } catch (err) {
            setStartError(err instanceof ApiError ? err.message : 'Failed to start session.');
        }
    }

    async function handleEnd(e: React.FormEvent) {
        e.preventDefault();
        if (!session) return;
        const mins = parseInt(activeMinutes || String(elapsedMinutes), 10);
        if (!mins || mins < 1) return;
        setSubmitting(true);
        try {
            await sessionsApi.end(session.id, mins);
            // Bug 6 fix: show debrief choice screen before starting flashcards
            setPhase('debrief');
        } catch (err) {
            setStartError(err instanceof ApiError ? err.message : 'Failed to end session.');
        } finally { setSubmitting(false); }
    }

    // Bug 6 fix: user chose to start debrief — create ReviewItem then go to flashcards
    async function handleStartDebrief() {
        if (!session) return;
        setSubmitting(true);
        try {
            const rev = await reviewsApi.create(selectedSubject, topic.trim());
            setReviewId(rev.review_id);
            setCards([]);
            setPhase('flashcards');
        } catch {
            // If review creation fails, still let them reflect
            setPhase('reviewing');
        } finally { setSubmitting(false); }
    }

    // Bug 6 fix: user chose to skip debrief — go straight to reflection
    function handleSkipDebrief() {
        setPhase('reviewing');
    }

    // Add a flashcard: save to backend immediately, then allow recall rating
    async function handleAddCard(e: React.FormEvent) {
        e.preventDefault();
        if (!cardQ.trim() || !cardA.trim() || !reviewId) return;
        setSavingCard(true); setCardError(null);
        try {
            const card = await reviewsApi.addFlashcard(reviewId, cardQ.trim(), cardA.trim());
            const draft: DraftCard = {
                id: crypto.randomUUID(),
                question: cardQ.trim(),
                answer: cardA.trim(),
                strength: null,
                cardId: card.card_id,
                saved: true,
            };
            setCards(prev => [...prev, draft]);
            setCardQ(''); setCardA('');
        } catch (err) {
            setCardError(err instanceof ApiError ? err.message : 'Failed to save card.');
        } finally { setSavingCard(false); }
    }

    // Rate a card's recall strength
    async function handleRate(localId: string, strength: RecallStrength) {
        if (!reviewId) return;
        const card = cards.find(c => c.id === localId);
        if (!card?.cardId) return;
        try {
            await reviewsApi.submitResult(reviewId, card.cardId, strength);
            setCards(prev => prev.map(c => c.id === localId ? { ...c, strength } : c));
        } catch { /* silent — rating is best-effort */ }
    }

    function proceedToQuiz() {
        setQuizAnswers({});
        setPhase('quiz');
    }

    function proceedToReflection() {
        setPhase('reviewing');
    }

    async function handleReview(e: React.FormEvent) {
        e.preventDefault();
        if (!session) return;
        setSubmitting(true);
        try {
            const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
            await sessionsApi.review(session.id, reflection, tagList);
        } catch { /* optional */ }
        finally { setSubmitting(false); resetAll(); }
    }

    function resetAll() {
        setPhase('idle'); setSession(null); setElapsed(0); setPaused(false);
        setTopic(''); setReflection(''); setTags(''); setActiveMinutes('');
        setStartError(null); setCards([]); setCardQ(''); setCardA('');
        setReviewId(null); setQuizAnswers({}); setCardError(null);
    }

    // ─────────────────────────────────────────────────────────────
    if (subjectsLoading) return <FullPageSpinner />;
    if (subjectsError) return <div className="py-8"><ErrorBanner message={subjectsError} onRetry={refreshSubjects} /></div>;

    return (
        <div className="animate-slide-up max-w-xl">
            <div className="page-header"><h1>Study Session</h1></div>

            {/* ── Step indicator (only shown during active flow) ────── */}
            {phase !== 'idle' && (
                <div className="flex items-center gap-1 mb-5 select-none">
                    {(['active', 'flashcards', 'quiz', 'reviewing'] as Phase[]).map((p, i) => {
                        const labels = ['Session', 'Flashcards', 'Quick Quiz', 'Reflection'];
                        const steps = ['active', 'flashcards', 'quiz', 'reviewing'];
                        const current = steps.indexOf(phase);
                        const done = i < current;
                        const active = i === current;
                        return (
                            <div key={p} className="flex items-center gap-1 flex-1 min-w-0">
                                <div className={`flex items-center gap-1.5 text-xs font-medium truncate ${active ? 'text-primary-400' : done ? 'text-green-400' : 'text-slate-600'
                                    }`}>
                                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 ${active ? 'bg-primary-600 text-white' : done ? 'bg-green-700 text-white' : 'bg-slate-700 text-slate-500'
                                        }`}>
                                        {done ? '✓' : i + 1}
                                    </span>
                                    <span className="hidden sm:inline">{labels[i]}</span>
                                </div>
                                {i < 3 && <div className={`h-px flex-1 mx-1 ${done ? 'bg-green-700' : 'bg-slate-700'}`} />}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ─────────────────────────────────────────────────────
                IDLE — Start Session Form
            ───────────────────────────────────────────────────── */}
            {phase === 'idle' && (
                <div className="card">
                    <p className="section-title">Start a Session</p>
                    {subjects.length === 0 ? (
                        <EmptyState title="No subjects" description="Add a subject before starting a session." />
                    ) : (
                        <form id="form-start-session" onSubmit={handleStart} className="flex flex-col gap-4 mt-2">
                            <select id="select-session-subject" value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}>
                                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                            <input id="input-session-topic" type="text" placeholder="Topic (e.g. Derivatives)"
                                value={topic} onChange={e => setTopic(e.target.value)} required />
                            <div className="flex gap-2">
                                {(['STUDY', 'REVISION'] as const).map(t => (
                                    <button key={t} type="button" id={`btn-type-${t.toLowerCase()}`}
                                        onClick={() => setSessionType(t)}
                                        className={sessionType === t ? 'btn-primary flex-1' : 'btn-secondary flex-1'}>
                                        {t === 'STUDY' ? '📖 Study' : '🔁 Revision'}
                                    </button>
                                ))}
                            </div>
                            {startError && <p className="text-sm text-amber-400">⚠ {startError}</p>}
                            <button id="btn-start-session" type="submit"
                                disabled={!selectedSubject || !topic.trim()} className="btn-primary">
                                Start Timed Session
                            </button>

                            {sessionType === 'REVISION' && (
                                <button
                                    type="button"
                                    id="btn-jump-to-revision"
                                    onClick={() => navigate('/reviews', { state: { subjectId: selectedSubject } })}
                                    className="btn-ghost text-xs text-indigo-600 hover:text-indigo-800 mt-1"
                                >
                                    Or jump to Revision Queue →
                                </button>
                            )}
                        </form>
                    )}
                </div>
            )}

            {/* ─────────────────────────────────────────────────────
                ACTIVE — Live Timer
            ───────────────────────────────────────────────────── */}
            {phase === 'active' && (
                <div className="card text-center">
                    <div className={`text-7xl font-mono font-bold my-6 transition-all duration-300 select-none ${paused ? 'text-amber-400 opacity-60' : 'text-primary-400'
                        }`}>
                        {fmt(elapsed)}
                    </div>

                    {paused && (
                        <div id="timer-paused-indicator"
                            className="flex items-center justify-center gap-2 text-amber-400 text-sm bg-amber-600/10 border border-amber-600/30 rounded-xl px-4 py-2 mb-4 animate-pulse">
                            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            Timer paused — return to this tab to resume
                        </div>
                    )}

                    <p className="text-slate-300 font-semibold text-lg">{topic}</p>
                    <p className="text-muted text-sm">{subjects.find(s => s.id === selectedSubject)?.name}</p>
                    <span className="inline-block text-xs text-slate-500 border border-slate-700 rounded-full px-2 py-0.5 mt-1 mb-6">
                        {sessionType}
                    </span>

                    {!paused && (
                        <div className="flex items-center justify-center gap-2 text-green-400 text-xs mb-5">
                            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
                            Recording active time
                        </div>
                    )}

                    <div className="border-t border-slate-700/50 pt-4 mt-2">
                        <p className="text-xs text-muted mb-3">
                            How many minutes were you truly focused?
                            {' '}(Timer suggests <strong className="text-slate-300">{elapsedMinutes}</strong> min)
                        </p>
                        <form id="form-end-session" onSubmit={handleEnd} className="flex flex-col gap-3">
                            <input id="input-active-minutes" type="number"
                                placeholder={`Minutes studied (suggested: ${elapsedMinutes})`}
                                min={1} max={1440} value={activeMinutes}
                                onChange={e => setActiveMinutes(e.target.value)} required />
                            {startError && <p className="text-sm text-amber-400">⚠ {startError}</p>}
                            <button id="btn-end-session" type="submit" disabled={submitting} className="btn-primary">
                                {submitting ? '…' : 'End Session'}
                            </button>
                            <button id="btn-abandon-session" type="button" onClick={resetAll}
                                className="btn-ghost btn-sm text-muted hover:text-red-400 text-xs">
                                Abandon session
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Notes Panel (active session) ──────────────────── */}
            {phase === 'active' && selectedSubject && (
                <div className="mt-4">
                    <NotesPanel
                        subjectId={selectedSubject}
                        topic={topic || undefined}
                        contextLabel={`${subjects.find(s => s.id === selectedSubject)?.name ?? ''}${topic ? ` – ${topic}` : ''}`}
                        onNotesChange={(text) => { liveNotesRef.current = text; }}
                    />
                </div>
            )}

            {/* ─────────────────────────────────────────────────────
                DEBRIEF — Choice screen after session ends (Bug 6 fix)
            ───────────────────────────────────────────────────── */}
            {phase === 'debrief' && (
                <div className="card text-center animate-slide-up">
                    <div className="text-4xl mb-4">🎯</div>
                    <h2 className="text-xl font-bold text-slate-100 mb-2">Session Complete!</h2>
                    <p className="text-muted text-sm mb-6">
                        Great work on <strong className="text-slate-300">{topic}</strong>.<br />
                        Would you like to consolidate what you learned?
                    </p>
                    <div className="flex flex-col gap-3">
                        <button
                            id="btn-start-debrief"
                            onClick={handleStartDebrief}
                            disabled={submitting}
                            className="btn-primary"
                        >
                            {submitting ? '…' : '🧠 Start Debrief — AI Flashcards + Quiz'}
                        </button>
                        <p className="text-xs text-muted">
                            Uses your notes from this session to auto-generate revision material
                        </p>
                        <button
                            id="btn-skip-debrief"
                            onClick={handleSkipDebrief}
                            className="btn-ghost text-sm text-muted hover:text-slate-300"
                        >
                            Skip → Go to Reflection
                        </button>
                    </div>
                </div>
            )}


            {/* ─────────────────────────────────────────────────────
                FLASHCARDS — Add & Rate cards for this topic
            ───────────────────────────────────────────────────── */}
            {phase === 'flashcards' && (
                <div className="flex flex-col gap-4">
                    <div className="card">
                        <div className="flex items-center justify-between mb-1">
                            <p className="section-title mb-0">Quick Flashcards</p>
                            <span className="text-xs text-muted">{cards.length} / 5 added</span>
                        </div>
                        <p className="text-muted text-xs mb-4">
                            Capture 1–5 key Q&amp;A pairs from this session on <strong className="text-slate-300">{topic}</strong>.
                        </p>

                        {/* Add card form (max 5) */}
                        {cards.length < 5 && (
                            <form id="form-add-flashcard" onSubmit={handleAddCard} className="flex flex-col gap-3 mb-4">
                                <input id="input-card-question" type="text" placeholder="Question"
                                    value={cardQ} onChange={e => setCardQ(e.target.value)} required />
                                <input id="input-card-answer" type="text" placeholder="Answer"
                                    value={cardA} onChange={e => setCardA(e.target.value)} required />
                                {cardError && <p className="text-xs text-amber-400">⚠ {cardError}</p>}
                                <button id="btn-add-flashcard" type="submit" disabled={savingCard || !cardQ.trim() || !cardA.trim()}
                                    className="btn-secondary btn-sm">
                                    {savingCard ? '…' : '+ Add Card'}
                                </button>
                            </form>
                        )}

                        {cards.length < 5 && (
                            <div className="border-t border-slate-700/50 pt-4 mt-2">
                                <button
                                    onClick={handleAiFlashcards}
                                    disabled={generating || !selectedSubject}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-sm font-semibold hover:bg-indigo-100 transition-all"
                                >
                                    {generating ? '✨ Generating...' : '✨ Generate from My Notes'}
                                </button>
                                {genError && <p className="text-xs text-red-500 mt-2 text-center">⚠ {genError}</p>}
                            </div>
                        )}
                        {/* Saved cards — rate each one */}
                        {cards.length > 0 && (
                            <ul className="flex flex-col gap-3">
                                {cards.map(card => (
                                    <li key={card.id} className="border border-indigo-100 rounded-xl p-4 bg-white shadow-sm border-l-4 border-l-indigo-400">
                                        <p className="text-sm font-semibold text-slate-800 mb-1">❓ {card.question}</p>
                                        <p className="text-sm text-indigo-700 mb-3">→ {card.answer}</p>
                                        <div className="flex gap-2">
                                            {(['WEAK', 'MODERATE', 'STRONG'] as RecallStrength[]).map(s => (
                                                <button
                                                    key={s}
                                                    type="button"
                                                    id={`btn-rate-${card.id}-${s.toLowerCase()}`}
                                                    onClick={() => handleRate(card.id, s)}
                                                    className={`flex-1 text-xs py-1.5 rounded-lg border transition-all duration-150 ${card.strength === s
                                                        ? RECALL_STYLES[s]
                                                        : 'border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600'
                                                        }`}
                                                >
                                                    {s === 'WEAK' ? '😕 Weak' : s === 'MODERATE' ? '🤔 Moderate' : '💪 Strong'}
                                                </button>
                                            ))}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Navigation */}
                    <div className="flex gap-3">
                        <button id="btn-flashcards-next" type="button" onClick={proceedToQuiz}
                            className="btn-primary flex-1">
                            {cards.length === 0 ? 'Skip Flashcards →' : 'Continue to Quiz →'}
                        </button>
                    </div>
                </div>
            )}

            {/* ─────────────────────────────────────────────────────
                QUIZ — Quick self-assessment (informational only)
            ───────────────────────────────────────────────────── */}
            {phase === 'quiz' && (
                <div className="card">
                    <p className="section-title">Quick Self-Check</p>
                    <p className="text-xs text-muted mb-5">
                        3 quick questions about your session. Answers are not stored — they're just for you.
                    </p>

                    <div className="flex flex-col gap-6">
                        {!dynamicQuiz && (
                            <button
                                onClick={handleAiQuiz}
                                disabled={generating}
                                className="w-full flex items-center justify-center gap-2 py-3 mb-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-bold hover:bg-emerald-100 transition-all shadow-sm"
                            >
                                {generating ? '✨ Generating Quiz...' : '✨ Generate Quiz from My Notes'}
                            </button>
                        )}
                        {genError && phase === 'quiz' && <p className="text-xs text-red-500 text-center">⚠ {genError}</p>}

                        {(dynamicQuiz
                            ? dynamicQuiz.map((q, qi) => {
                                const qid = `ai-${qi}`;
                                return (
                                    <div key={qid} id={`quiz-q-${qi + 1}`}>
                                        <p className="text-sm font-medium text-slate-200 mb-3">
                                            <span className="text-muted mr-2">{qi + 1}.</span>{q.question}
                                        </p>
                                        <div className="flex flex-col gap-2">
                                            {q.options.map((opt: string, oi: number) => {
                                                const selected = quizAnswers[qid] === opt;
                                                return (
                                                    <button
                                                        key={oi}
                                                        type="button"
                                                        id={`quiz-${qid}-opt-${oi}`}
                                                        onClick={() => setQuizAnswers(prev => ({ ...prev, [qid]: opt }))}
                                                        className={`w-full text-left text-sm px-4 py-3 rounded-xl border transition-all duration-150 ${selected
                                                            ? 'bg-primary-600/20 border-primary-500/50 text-primary-300'
                                                            : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300 bg-slate-800/30'
                                                            }`}
                                                    >
                                                        <span className={`mr-3 text-xs ${selected ? 'text-primary-400' : 'text-slate-600'}`}>
                                                            {selected ? '●' : '○'}
                                                        </span>
                                                        {opt}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })
                            : QUIZ_QUESTIONS.map((q, qi) => {
                                const qid = q.id;
                                const selected_val = quizAnswers[qid];
                                return (
                                    <div key={qid} id={`quiz-q-${qi + 1}`}>
                                        <p className="text-sm font-medium text-slate-200 mb-3">
                                            <span className="text-muted mr-2">{qi + 1}.</span>{q.text}
                                        </p>
                                        <div className="flex flex-col gap-2">
                                            {q.options.map((opt: string, oi: number) => {
                                                const selected = selected_val === opt;
                                                return (
                                                    <button
                                                        key={oi}
                                                        type="button"
                                                        id={`quiz-${qid}-opt-${oi}`}
                                                        onClick={() => setQuizAnswers(prev => ({ ...prev, [qid]: opt }))}
                                                        className={`w-full text-left text-sm px-4 py-3 rounded-xl border transition-all duration-150 ${selected
                                                            ? 'bg-primary-600/20 border-primary-500/50 text-primary-300'
                                                            : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300 bg-slate-800/30'
                                                            }`}
                                                    >
                                                        <span className={`mr-3 text-xs ${selected ? 'text-primary-400' : 'text-slate-600'}`}>
                                                            {selected ? '●' : '○'}
                                                        </span>
                                                        {opt}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <button
                        id="btn-quiz-next"
                        type="button"
                        onClick={proceedToReflection}
                        className="btn-primary w-full mt-6"
                    >
                        Continue to Reflection →
                    </button>
                    <button type="button" onClick={proceedToReflection}
                        className="btn-ghost btn-sm text-muted text-xs w-full mt-2">
                        Skip quiz
                    </button>
                </div>
            )}

            {/* ─────────────────────────────────────────────────────
                REVIEWING — Reflection & Tags (stored verbatim)
            ───────────────────────────────────────────────────── */}
            {phase === 'reviewing' && (
                <div className="card">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-9 h-9 rounded-xl bg-green-600/20 flex items-center justify-center shrink-0">
                            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-green-400">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div>
                            <p className="font-semibold text-slate-200">Session complete!</p>
                            <p className="text-muted text-xs">
                                {elapsedMinutes} min · {cards.length} flashcard{cards.length !== 1 ? 's' : ''} · {topic}
                            </p>
                        </div>
                    </div>

                    <p className="section-title">Post-Session Reflection</p>
                    <form id="form-session-review" onSubmit={handleReview} className="flex flex-col gap-4 mt-2">
                        <textarea id="input-reflection"
                            placeholder="What did you understand? What needs more work?"
                            value={reflection} onChange={e => setReflection(e.target.value)}
                            rows={4} className="resize-none" />
                        <input id="input-tags" type="text"
                            placeholder="Tags (comma-separated, e.g. calculus, revision)"
                            value={tags} onChange={e => setTags(e.target.value)} />
                        <button id="btn-submit-review" type="submit" disabled={submitting} className="btn-primary">
                            {submitting ? '…' : 'Submit & Complete'}
                        </button>
                    </form>

                    {/* ── Notes Panel (reflection phase) ───────────── */}
                    <div className="mt-6 border-t border-slate-100 pt-6">
                        <NotesPanel
                            subjectId={selectedSubject}
                            topic={topic || undefined}
                            contextLabel={`${subjects.find(s => s.id === selectedSubject)?.name ?? ''}${topic ? ` – ${topic}` : ''}`}
                        />
                    </div>
                    <button id="btn-skip-review" type="button" onClick={resetAll} className="btn-secondary text-sm">
                        Skip
                    </button>
                </div>
            )}
        </div>
    );
}

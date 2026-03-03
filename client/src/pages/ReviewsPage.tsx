import { useEffect, useState } from 'react';
import { reviewsApi, ApiError } from '../lib/api';
import { useSubjects } from '../context/SubjectsContext';
import type { ReviewItem, Flashcard, RecallStrength } from '../types/api';
import { FullPageSpinner, ErrorBanner, EmptyState, SkeletonRow } from '../components/ui';
import { NotesPanel } from '../components/NotesPanel';

// ─── Helpers ─────────────────────────────────────────────────────

const STRENGTH_META: Record<RecallStrength, { label: string; cls: string; ringCls: string; priority: number }> = {
    WEAK: { label: 'Still learning', cls: 'badge-warning', ringCls: 'ring-1 ring-amber-600/50', priority: 0 },
    MODERATE: { label: 'Getting there', cls: 'badge-info', ringCls: 'ring-1 ring-sky-600/40', priority: 1 },
    STRONG: { label: 'Confident', cls: 'badge-success', ringCls: 'ring-1 ring-green-600/40', priority: 2 },
};

/** Sort queue: WEAK → MODERATE → STRONG */
function sortByPriority(items: ReviewItem[]) {
    return [...items].sort((a, b) =>
        STRENGTH_META[a.recall_strength].priority - STRENGTH_META[b.recall_strength].priority
    );
}

/** Group queue by subject_id, preserving priority sort within each group */
function groupBySubject(items: ReviewItem[]): Record<string, ReviewItem[]> {
    const sorted = sortByPriority(items);
    return sorted.reduce<Record<string, ReviewItem[]>>((acc, item) => {
        if (!acc[item.subject_id]) acc[item.subject_id] = [];
        acc[item.subject_id].push(item);
        return acc;
    }, {});
}

// Locally extended flashcard during a practice session (adds revealed answer)
interface PracticeCard extends Flashcard {
    localAnswer?: string;   // typed in by user if they want — not from API
    revealed: boolean;
    rated: boolean;
}

type PracticePhase = 'queue' | 'cards' | 'done';

// ─── Component ───────────────────────────────────────────────────

export function ReviewsPage() {
    const { subjects, loading: subjectsLoading } = useSubjects();

    const [queue, setQueue] = useState<ReviewItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // ── Create form ──────────────────────────────────────────────
    const [selectedSubject, setSelectedSubject] = useState('');
    const [topic, setTopic] = useState('');
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    // ── Practice mode ────────────────────────────────────────────
    const [phase, setPhase] = useState<PracticePhase>('queue');
    const [activeReview, setActiveReview] = useState<ReviewItem | null>(null);
    const [cards, setCards] = useState<PracticeCard[]>([]);
    const [cardIndex, setCardIndex] = useState(0);
    const [cardsLoading, setCardsLoading] = useState(false);

    // ── Add-card form inside practice ────────────────────────────
    const [addQ, setAddQ] = useState('');
    const [addA, setAddA] = useState('');

    // ─────────────────────────────────────────────────────────────
    async function load() {
        setLoading(true); setError(null);
        try {
            const q = await reviewsApi.queue();
            setQueue(q);
        } catch { setError('Could not load revision queue.'); }
        finally { setLoading(false); }
    }
    useEffect(() => { load(); }, []);

    // Auto-select first subject from context
    useEffect(() => {
        if (subjects.length > 0 && !selectedSubject) setSelectedSubject(subjects[0].id);
    }, [subjects, selectedSubject]);

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        if (!topic.trim() || !selectedSubject) return;
        setCreating(true); setCreateError(null);
        try {
            const item = await reviewsApi.create(selectedSubject, topic.trim());
            setQueue(prev => [...prev, item]);
            setTopic('');
        } catch (err) {
            setCreateError(err instanceof ApiError ? err.message : 'Failed to add topic.');
        } finally { setCreating(false); }
    }

    async function startPractice(review: ReviewItem) {
        setActiveReview(review);
        setCardsLoading(true);
        setPhase('cards');
        setAddQ(''); setAddA('');
        try {
            const fetchedCards = await reviewsApi.getFlashcards(review.review_id);
            const practiceCards: PracticeCard[] = fetchedCards.map(c => ({
                ...c,
                revealed: false,
                rated: false,
            }));
            setCards(practiceCards);
            setCardIndex(0);
        } finally {
            setCardsLoading(false);
        }
    }

    async function handleAddCard(e: React.FormEvent) {
        e.preventDefault();
        if (!activeReview || !addQ.trim() || !addA.trim()) return;
        const card = await reviewsApi.addFlashcard(activeReview.review_id, addQ.trim(), addA.trim());
        const practiceCard: PracticeCard = {
            ...card,
            localAnswer: addA.trim(),  // store locally for reveal
            revealed: false,
            rated: false,
        };
        setCards(prev => [...prev, practiceCard]);
        setAddQ(''); setAddA('');
    }

    function revealCard() {
        setCards(prev => prev.map((c, i) => i === cardIndex ? { ...c, revealed: true } : c));
    }

    async function submitResult(strength: RecallStrength) {
        if (!activeReview || !cards[cardIndex]) return;
        const card = cards[cardIndex];
        await reviewsApi.submitResult(activeReview.review_id, card.card_id, strength);
        setCards(prev => prev.map((c, i) => i === cardIndex ? { ...c, rated: true } : c));
        if (cardIndex + 1 < cards.length) {
            setCardIndex(i => i + 1);
        } else {
            setPhase('done');
            const fresh = await reviewsApi.queue();
            setQueue(fresh);
        }
    }

    function subjectName(id: string) {
        return subjects.find(s => s.id === id)?.name ?? '…';
    }

    // ─── Loading / Error ─────────────────────────────────────────
    if (subjectsLoading || loading) return <FullPageSpinner />;
    if (error) return <div className="py-8"><ErrorBanner message={error} onRetry={load} /></div>;

    // ─────────────────────────────────────────────────────────────
    // PRACTICE — Card-by-card (distinct from session flow)
    // No timer. No quiz. Pure recall-based flashcard practice.
    // ─────────────────────────────────────────────────────────────
    if (phase === 'cards' && activeReview) {
        const card = cardsLoading ? null : cards[cardIndex];
        const totalRated = cards.filter(c => c.rated).length;

        return (
            <div className="animate-slide-up max-w-xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <p className="text-xs text-muted uppercase tracking-widest mb-0.5">Revision</p>
                        <h1 className="m-0">{activeReview.topic}</h1>
                        <p className="text-muted text-sm">{subjectName(activeReview.subject_id)}</p>
                    </div>
                    <button id="btn-exit-practice" onClick={() => { setPhase('queue'); setCards([]); }}
                        className="btn-ghost btn-sm text-muted">✕ Exit</button>
                </div>

                {/* Progress bar */}
                {!cardsLoading && cards.length > 0 && (
                    <div className="mb-4">
                        <div className="flex justify-between text-xs text-muted mb-1">
                            <span>Card {cardIndex + 1} of {cards.length}</span>
                            <span>{totalRated} rated</span>
                        </div>
                        <div className="h-1 rounded-full bg-slate-700">
                            <div
                                className="h-1 rounded-full bg-primary-500 transition-all duration-300"
                                style={{ width: `${((cardIndex) / cards.length) * 100}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Cards */}
                {cardsLoading ? (
                    <SkeletonRow count={3} />
                ) : cards.length === 0 ? (
                    <div className="card text-center">
                        <EmptyState
                            title="No flashcards yet"
                            description="Add cards below to start practicing this topic."
                        />
                    </div>
                ) : !card ? null : (
                    <div id="flashcard-display" className="card text-center mb-4">
                        {/* Question */}
                        <p className="text-xs text-muted uppercase tracking-widest mb-4">Question</p>
                        <p className="text-xl font-medium text-slate-200 leading-relaxed mb-6 min-h-[3rem]">
                            {card.question}
                        </p>

                        {/* Answer reveal */}
                        {!card.revealed ? (
                            <button id="btn-reveal-answer" type="button" onClick={revealCard}
                                className="btn-secondary btn-sm mx-auto">
                                Reveal Answer
                            </button>
                        ) : (
                            <>
                                <div className="border-t border-slate-700/50 pt-4 mb-6">
                                    <p className="text-xs text-muted uppercase tracking-widest mb-2">Answer</p>
                                    <p className="text-slate-300 text-base leading-relaxed">
                                        {card.localAnswer ?? '(Rate your recall below)'}
                                    </p>
                                </div>
                                <p className="text-sm text-muted mb-3">How well did you recall this?</p>
                                <div className="flex gap-2 justify-center">
                                    {(['WEAK', 'MODERATE', 'STRONG'] as RecallStrength[]).map(s => (
                                        <button
                                            key={s}
                                            id={`btn-recall-${s.toLowerCase()}`}
                                            type="button"
                                            onClick={() => submitResult(s)}
                                            className={`flex-1 text-sm py-2.5 rounded-xl border font-medium transition-all duration-150 ${s === 'WEAK'
                                                ? 'border-amber-600/40 text-amber-400 hover:bg-amber-600/20'
                                                : s === 'MODERATE'
                                                    ? 'border-sky-600/40 text-sky-400 hover:bg-sky-600/20'
                                                    : 'border-green-600/40 text-green-400 hover:bg-green-600/20'
                                                }`}
                                        >
                                            {s === 'WEAK' ? '😕 Weak' : s === 'MODERATE' ? '🤔 Moderate' : '💪 Strong'}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Add card to this topic */}
                <div className="card">
                    <p className="section-title text-sm">Add a Flashcard to this Topic</p>
                    <form id="form-add-card" onSubmit={handleAddCard} className="flex flex-col gap-2 mt-2">
                        <input id="input-card-q" type="text" placeholder="Question"
                            value={addQ} onChange={e => setAddQ(e.target.value)} />
                        <input id="input-card-a" type="text" placeholder="Answer (stored locally for reveal)"
                            value={addA} onChange={e => setAddA(e.target.value)} />
                        <button id="btn-add-card" type="submit"
                            disabled={!addQ.trim() || !addA.trim()}
                            className="btn-secondary btn-sm">
                            + Add Card
                        </button>
                    </form>
                </div>

                {/* ── Notes Panel (practice session) ───────────── */}
                {activeReview && (
                    <div className="mt-8 pt-8 border-t border-slate-700/50">
                        <NotesPanel
                            subjectId={activeReview.subject_id}
                            topic={activeReview.topic}
                            contextLabel={`${subjects.find(s => s.id === activeReview.subject_id)?.name ?? ''} – ${activeReview.topic}`}
                        />
                    </div>
                )}
            </div>
        );
    }

    // ─── DONE screen ─────────────────────────────────────────────
    if (phase === 'done') {
        return (
            <div className="animate-slide-up max-w-xl text-center py-16">
                <div className="w-16 h-16 rounded-full bg-green-600/20 flex items-center justify-center mx-auto mb-4">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-8 h-8 text-green-400">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                </div>
                <h2>Revision complete</h2>
                <p className="text-muted mt-2 mb-6">Your recall strength has been updated in the queue.</p>
                <button id="btn-back-queue" onClick={() => setPhase('queue')} className="btn-primary">
                    Back to Revision Queue
                </button>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────
    // QUEUE — Topic-wise grouped list (distinct from session review)
    // ─────────────────────────────────────────────────────────────
    const grouped = groupBySubject(queue);
    const subjectIds = Object.keys(grouped);

    const totalWeak = queue.filter(q => q.recall_strength === 'WEAK').length;

    return (
        <div className="animate-slide-up max-w-2xl">
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1>Revision Queue</h1>
                    <p className="text-muted text-sm mt-0.5">
                        Topic-wise practice for long-term retention.
                        {totalWeak > 0 && (
                            <span className="ml-2 text-amber-400 font-medium">
                                ⚠ {totalWeak} topic{totalWeak !== 1 ? 's' : ''} need urgent revision
                            </span>
                        )}
                    </p>
                </div>
                <button id="btn-refresh-queue" onClick={load}
                    className="btn-ghost btn-sm text-muted">↻ Refresh</button>
            </div>

            {/* Add review item */}
            <div className="card mb-6">
                <p className="section-title">Add Topic to Queue</p>
                <p className="text-xs text-muted mb-3">
                    Topics added here are distinct from your study sessions. Use this for topics you want to revisit days later.
                </p>
                {subjects.length === 0 ? (
                    <EmptyState title="No subjects" description="Add a subject first." />
                ) : (
                    <form id="form-create-review" onSubmit={handleCreate} className="flex flex-col gap-3 mt-2">
                        <select id="select-review-subject" value={selectedSubject}
                            onChange={e => setSelectedSubject(e.target.value)}>
                            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <div className="flex gap-3">
                            <input id="input-review-topic" type="text" placeholder="Topic to revise"
                                value={topic} onChange={e => setTopic(e.target.value)} className="flex-1" />
                            <button id="btn-create-review" type="submit"
                                disabled={creating || !topic.trim()} className="btn-primary">
                                {creating ? '…' : 'Add'}
                            </button>
                        </div>
                    </form>
                )}
                {createError && <p className="text-xs text-amber-400 mt-2">⚠ {createError}</p>}
            </div>

            {/* Queue — grouped by subject, sorted WEAK first */}
            {queue.length === 0 ? (
                <div className="card">
                    <EmptyState
                        title="Revision queue is empty"
                        description="Topics are added automatically after study sessions, or you can add them manually above."
                    />
                </div>
            ) : (
                <div className="flex flex-col gap-6">
                    {subjectIds.map(subId => {
                        const items = grouped[subId];
                        const hasWeak = items.some(i => i.recall_strength === 'WEAK');
                        return (
                            <div key={subId} className="card">
                                {/* Subject header */}
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-2 h-2 rounded-full bg-primary-500 shrink-0" />
                                    <p className="font-semibold text-slate-200">{subjectName(subId)}</p>
                                    {hasWeak && (
                                        <span className="text-xs text-amber-400 border border-amber-600/30 rounded-full px-2 py-0.5">
                                            needs attention
                                        </span>
                                    )}
                                    <span className="text-xs text-muted ml-auto">{items.length} topic{items.length !== 1 ? 's' : ''}</span>
                                </div>

                                {/* Topics within this subject */}
                                <ul className="flex flex-col gap-2">
                                    {items.map(item => {
                                        const meta = STRENGTH_META[item.recall_strength];
                                        return (
                                            <li key={item.review_id}
                                                className={`flex items-center justify-between py-2.5 px-3 rounded-xl bg-slate-800/40 ${meta.ringCls}`}>
                                                <div className="min-w-0">
                                                    <p className="text-slate-200 font-medium truncate">{item.topic}</p>
                                                    <span className={`badge mt-1 ${meta.cls}`}>{meta.label}</span>
                                                </div>
                                                <button
                                                    id={`btn-practice-${item.review_id}`}
                                                    type="button"
                                                    onClick={() => startPractice(item)}
                                                    className={`btn-sm ml-3 shrink-0 ${item.recall_strength === 'WEAK'
                                                        ? 'btn-primary'
                                                        : 'btn-secondary'
                                                        }`}
                                                >
                                                    {item.recall_strength === 'WEAK' ? '⚡ Revise Now' : 'Revise'}
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

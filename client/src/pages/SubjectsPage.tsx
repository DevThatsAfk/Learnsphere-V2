import { useState } from 'react';
import { useSubjects, ApiError } from '../context/SubjectsContext';
import { ErrorBanner, EmptyState, SkeletonRow } from '../components/ui';

// Simple colour palette for subject indicators
const PALETTE = [
    'bg-primary-500', 'bg-accent-500', 'bg-green-500',
    'bg-amber-500', 'bg-sky-500', 'bg-rose-500',
    'bg-teal-500', 'bg-orange-500',
];

// ─── Inline rename row ────────────────────────────────────────────
function SubjectRow({
    subject,
    index,
    onRename,
    onDelete,
}: {
    subject: { id: string; name: string };
    index: number;
    onRename: (id: string, name: string) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
}) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(subject.name);
    const [saving, setSaving] = useState(false);
    const [renameError, setRenameError] = useState<string | null>(null);

    async function handleSave() {
        const trimmed = draft.trim();
        if (!trimmed || trimmed === subject.name) { setEditing(false); return; }
        setSaving(true); setRenameError(null);
        try {
            await onRename(subject.id, trimmed);
            setEditing(false);
        } catch (err) {
            setRenameError(err instanceof ApiError ? err.message : 'Failed to rename subject.');
        } finally { setSaving(false); }
    }

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') { setDraft(subject.name); setEditing(false); setRenameError(null); }
    }

    return (
        <li
            className="group flex flex-col gap-1 rounded-xl px-2 py-3 hover:bg-white/3 transition-colors duration-150"
        >
            <div className="flex items-center gap-3">
                {/* Color indicator */}
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${PALETTE[index % PALETTE.length]}`} />

                {/* Name / inline edit */}
                {editing ? (
                    <input
                        id={`input-rename-subject-${subject.id}`}
                        autoFocus
                        type="text"
                        value={draft}
                        onChange={e => setDraft(e.target.value)}
                        onKeyDown={handleKeyDown}
                        maxLength={100}
                        className="flex-1 text-sm py-0.5"
                        disabled={saving}
                    />
                ) : (
                    <span className="flex-1 text-slate-200 font-medium">{subject.name}</span>
                )}

                <div className="flex items-center gap-1 shrink-0">
                    {editing ? (
                        <>
                            <button
                                id={`btn-save-rename-${subject.id}`}
                                onClick={handleSave}
                                disabled={saving || !draft.trim()}
                                className="btn-primary btn-sm text-xs px-2 py-1"
                            >
                                {saving ? '…' : 'Save'}
                            </button>
                            <button
                                onClick={() => { setDraft(subject.name); setEditing(false); setRenameError(null); }}
                                className="btn-ghost btn-sm text-xs text-muted"
                            >
                                Cancel
                            </button>
                        </>
                    ) : (
                        <>
                            {/* Rename — pencil icon, visible on hover */}
                            <button
                                id={`btn-rename-subject-${subject.id}`}
                                onClick={() => { setDraft(subject.name); setEditing(true); }}
                                className="btn-ghost btn-sm text-transparent group-hover:text-muted hover:!text-primary-400 transition-colors duration-150"
                                aria-label={`Rename ${subject.name}`}
                            >
                                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                </svg>
                            </button>
                            {/* Delete */}
                            <button
                                id={`btn-delete-subject-${subject.id}`}
                                onClick={() => onDelete(subject.id)}
                                className="btn-ghost btn-sm text-transparent group-hover:text-muted hover:!text-red-400 transition-colors duration-150"
                                aria-label={`Delete ${subject.name}`}
                            >
                                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Inline rename error */}
            {renameError && (
                <p className="text-xs text-amber-400 pl-6">⚠ {renameError}</p>
            )}
        </li>
    );
}

// ─── Page ─────────────────────────────────────────────────────────
export function SubjectsPage() {
    // All subject data and mutations from global context
    const {
        subjects,
        loading,
        error,
        refreshSubjects,
        createSubject,
        renameSubject,
        deleteSubject,
    } = useSubjects();

    const [newName, setNewName] = useState('');
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        if (!newName.trim()) return;
        setCreating(true); setCreateError(null);
        try {
            await createSubject(newName.trim()); // refreshSubjects() called inside
            setNewName('');
        } catch (err) {
            setCreateError(err instanceof ApiError ? err.message : 'Failed to create subject.');
        } finally { setCreating(false); }
    }

    async function handleDelete(id: string) {
        try { await deleteSubject(id); }  // refreshSubjects() called inside
        catch (err) {
            // surface to page-level error so user sees it
            console.error('Delete failed:', err);
        }
    }

    async function handleRename(id: string, name: string) {
        await renameSubject(id, name); // refreshSubjects() called inside — propagates everywhere
    }

    return (
        <div className="animate-slide-up max-w-2xl">
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1>Subjects</h1>
                    <p className="text-muted text-sm mt-0.5">
                        {loading ? '…' : `${subjects.length} subject${subjects.length !== 1 ? 's' : ''}`}
                    </p>
                </div>
            </div>

            {/* Add subject form */}
            <div className="card mb-6">
                <p className="section-title">Add Subject</p>
                <form id="form-create-subject" onSubmit={handleCreate} className="flex gap-3 mt-2">
                    <input
                        id="input-subject-name"
                        type="text"
                        placeholder="e.g. Mathematics, Chemistry…"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        className="flex-1"
                        maxLength={100}
                    />
                    <button
                        id="btn-create-subject"
                        type="submit"
                        disabled={creating || !newName.trim()}
                        className="btn-primary"
                    >
                        {creating ? <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Add'}
                    </button>
                </form>
                {createError && (
                    <p role="alert" className="text-xs text-amber-400 bg-amber-600/10 border border-amber-600/20 rounded-lg px-3 py-2 mt-2">
                        ⚠ {createError}
                    </p>
                )}
            </div>

            {/* Subject list */}
            <div className="card">
                <p className="section-title">Your Subjects</p>
                <p className="text-xs text-muted mb-2">Hover a subject to rename or delete it. Changes propagate everywhere instantly.</p>

                {loading ? (
                    <div className="flex flex-col gap-3 mt-3"><SkeletonRow count={3} /></div>
                ) : error ? (
                    <ErrorBanner message={error} onRetry={refreshSubjects} />
                ) : subjects.length === 0 ? (
                    <EmptyState
                        title="No subjects yet"
                        description="Add your first subject to get started tracking your study time."
                    />
                ) : (
                    <ul className="flex flex-col gap-0.5 mt-2">
                        {subjects.map((s, i) => (
                            <SubjectRow
                                key={s.id}
                                subject={s}
                                index={i}
                                onRename={handleRename}
                                onDelete={handleDelete}
                            />
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

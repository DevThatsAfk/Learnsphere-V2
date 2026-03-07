/**
 * NotesPanel — Inline study notes editor.
 *
 * Rules:
 *  - Notes are user-authored. AI never reads or modifies this component.
 *  - One "active note" per (subjectId, topic) pair.
 *  - Auto-saves 1.5 s after the user stops typing (debounce).
 *  - Supports plain text + bullet points (typed manually or via Bullets toolbar btn).
 *  - Past notes (same subject, same topic) shown in a collapsible list below.
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import { notesApi } from '../lib/api';
import type { Note } from '../types/api';

interface NotesPanelProps {
    subjectId: string;
    topic?: string;
    /** Visual context label e.g. "Mathematics – Calculus" */
    contextLabel?: string;
    /** Called whenever the draft text changes — lets parent read live content for AI generation */
    onNotesChange?: (text: string) => void;
}

const SAVE_DEBOUNCE_MS = 1500;

export function NotesPanel({ subjectId, topic, contextLabel, onNotesChange }: NotesPanelProps) {
    const [notes, setNotes] = useState<Note[]>([]);
    const [draft, setDraft] = useState('');
    const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [expanded, setExpanded] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // ── Load notes for this context ───────────────────────────────
    const load = useCallback(async () => {
        if (!subjectId) return;
        try {
            // Fetch all notes for this subject+topic (if topic given) OR all subject notes
            const list = await notesApi.list(subjectId, topic);
            setNotes(list);
            // Use the most-recently-updated note as the active draft
            if (list.length > 0) {
                const latest = list[0];
                setActiveNoteId(latest.id);
                setDraft(latest.content);
                onNotesChange?.(latest.content);
            } else {
                setActiveNoteId(null);
                setDraft('');
                onNotesChange?.('');
            }
        } catch {
            setLoadError('Could not load notes.');
        }
    }, [subjectId, topic]);

    useEffect(() => { load(); }, [load]);

    // ── Auto-resize textarea ──────────────────────────────────────
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [draft]);

    // ── Debounced save ────────────────────────────────────────────
    const saveNote = useCallback(async (text: string) => {
        if (!subjectId) return;
        setSaveStatus('saving');
        setSaving(true);
        try {
            if (activeNoteId) {
                const updated = await notesApi.update(activeNoteId, text);
                setNotes(prev => prev.map(n => n.id === updated.id ? updated : n));
            } else {
                const created = await notesApi.create(subjectId, text, topic);
                setActiveNoteId(created.id);
                setNotes(prev => [created, ...prev]);
            }
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch {
            setSaveStatus('error');
        } finally {
            setSaving(false);
        }
    }, [subjectId, topic, activeNoteId]);

    const handleChange = (val: string) => {
        setDraft(val);
        setSaveStatus('idle');
        onNotesChange?.(val);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (val.trim()) {
            debounceRef.current = setTimeout(() => saveNote(val), SAVE_DEBOUNCE_MS);
        }
    };

    // ── New note ──────────────────────────────────────────────────
    const handleNewNote = () => {
        setActiveNoteId(null);
        setDraft('');
        setSaveStatus('idle');
        textareaRef.current?.focus();
    };

    // ── Delete note ───────────────────────────────────────────────
    const handleDelete = async (noteId: string) => {
        try {
            await notesApi.delete(noteId);
            setNotes(prev => prev.filter(n => n.id !== noteId));
            if (activeNoteId === noteId) {
                const remaining = notes.filter(n => n.id !== noteId);
                if (remaining.length > 0) {
                    setActiveNoteId(remaining[0].id);
                    setDraft(remaining[0].content);
                } else {
                    setActiveNoteId(null);
                    setDraft('');
                }
            }
        } catch {
            // Silent — user can retry
        }
    };

    // ── Bullet toolbar button ─────────────────────────────────────
    const insertBullet = () => {
        const ta = textareaRef.current;
        if (!ta) return;
        const start = ta.selectionStart;
        const before = draft.slice(0, start);
        const after = draft.slice(start);
        const needsNewline = before.length > 0 && !before.endsWith('\n');
        const insertion = (needsNewline ? '\n' : '') + '• ';
        const newVal = before + insertion + after;
        setDraft(newVal);
        handleChange(newVal);
        // Move cursor after bullet
        setTimeout(() => {
            ta.selectionStart = ta.selectionEnd = start + insertion.length + (needsNewline ? 1 : 0);
            ta.focus();
        }, 0);
    };

    // ── Past notes (all but active) ───────────────────────────────
    const pastNotes = notes.filter(n => n.id !== activeNoteId);

    const statusColour = {
        idle: 'text-slate-400',
        saving: 'text-indigo-500',
        saved: 'text-emerald-600',
        error: 'text-red-500',
    }[saveStatus];

    const statusText = {
        idle: 'Auto-save on',
        saving: 'Saving…',
        saved: '✓ Saved',
        error: 'Save failed — will retry',
    }[saveStatus];

    return (
        <div className="rounded-2xl border border-indigo-100 bg-white shadow-card overflow-hidden">
            {/* Header */}
            <div
                className="flex items-center justify-between px-4 py-3 border-b border-indigo-50"
                style={{ background: 'linear-gradient(90deg, #eef2ff 0%, #f0fdf9 100%)' }}
            >
                <div className="flex items-center gap-2">
                    {/* Notebook icon */}
                    <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4 text-indigo-600" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round"
                            d="M4 4h12a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1zm3 0v12M7 7h6M7 10h4" />
                    </svg>
                    <span className="text-sm font-semibold text-indigo-800">My Notes</span>
                    {contextLabel && (
                        <span className="text-xs text-slate-400 truncate max-w-[140px]">— {contextLabel}</span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium ${statusColour} transition-colors`}>{statusText}</span>
                    <button
                        onClick={handleNewNote}
                        title="Start a new note"
                        className="btn-ghost btn-sm text-indigo-600 hover:bg-indigo-50"
                    >
                        + New
                    </button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-1 px-4 py-1.5 border-b border-slate-100 bg-slate-50">
                <button
                    onClick={insertBullet}
                    title="Insert bullet point"
                    className="text-xs font-bold px-2.5 py-1 rounded-lg text-slate-600 hover:bg-white hover:text-indigo-600 hover:shadow-sm transition-all"
                >
                    • Bullet
                </button>
                <span className="text-slate-200 mx-1">|</span>
                <span className="text-xs text-slate-400">Plain text — your notes, never modified by AI</span>
            </div>

            {/* Textarea */}
            <div className="px-4 pt-3 pb-2">
                {loadError ? (
                    <p className="text-sm text-red-500 py-2">{loadError}</p>
                ) : (
                    <textarea
                        ref={textareaRef}
                        id="notes-panel-textarea"
                        value={draft}
                        onChange={e => handleChange(e.target.value)}
                        placeholder={topic
                            ? `Write your notes for "${topic}" here…\n\nTip: use • Bullet to add bullet points.`
                            : 'Write your study notes here…'}
                        className="w-full min-h-[120px] max-h-48 resize-y font-mono text-sm leading-relaxed text-slate-800 bg-transparent border-none outline-none placeholder:text-slate-300"
                        style={{ fontFamily: 'Inter, monospace' }}
                        disabled={saving}
                    />
                )}
            </div>

            {/* Past notes */}
            {pastNotes.length > 0 && (
                <div className="border-t border-slate-100">
                    <button
                        onClick={() => setExpanded(e => !e)}
                        className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-50 transition-colors"
                    >
                        <span>Past notes ({pastNotes.length})</span>
                        <span className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>▼</span>
                    </button>

                    {expanded && (
                        <div className="flex flex-col divide-y divide-slate-50 max-h-96 overflow-y-auto pr-1">
                            {pastNotes.map(note => (
                                <div key={note.id} className="group flex items-start gap-2 px-4 py-3 hover:bg-slate-50 transition-colors">
                                    <div
                                        className="flex-1 text-sm text-slate-700 font-mono whitespace-pre-wrap leading-relaxed cursor-pointer"
                                        onClick={() => {
                                            setActiveNoteId(note.id);
                                            setDraft(note.content);
                                        }}
                                    >
                                        {note.content.slice(0, 200)}{note.content.length > 200 ? '…' : ''}
                                    </div>
                                    <button
                                        onClick={() => handleDelete(note.id)}
                                        title="Delete note"
                                        className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-red-500 shrink-0 p-1"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

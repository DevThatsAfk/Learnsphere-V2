import { useEffect, useState } from 'react';
import { tasksApi, ApiError } from '../lib/api';
import { useSubjects } from '../context/SubjectsContext';
import type { Task, ChecklistItem } from '../types/api';
import { FullPageSpinner, ErrorBanner, EmptyState, SkeletonRow, ProgressBar } from '../components/ui';

export function TasksPage() {
    // Subjects come from global context — always up-to-date after renames
    const { subjects, loading: subjectsLoading } = useSubjects();

    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Create form
    const [selectedSubject, setSelectedSubject] = useState('');
    const [newTitle, setNewTitle] = useState('');
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    // Expanded task checklist
    const [expanded, setExpanded] = useState<string | null>(null);
    const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
    const [clLoading, setClLoading] = useState(false);
    const [newItem, setNewItem] = useState('');

    // Auto-select first subject once loaded
    useEffect(() => {
        if (subjects.length > 0 && !selectedSubject) setSelectedSubject(subjects[0].id);
    }, [subjects, selectedSubject]);

    async function load() {
        setLoading(true); setError(null);
        try { setTasks(await tasksApi.list()); }
        catch { setError('Could not load tasks.'); }
        finally { setLoading(false); }
    }
    useEffect(() => { load(); }, []);

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        if (!newTitle.trim() || !selectedSubject) return;
        setCreating(true); setCreateError(null);
        try {
            const task = await tasksApi.create(selectedSubject, newTitle.trim());
            setTasks(prev => [...prev, task]);
            setNewTitle('');
        } catch (err) {
            setCreateError(err instanceof ApiError ? err.message : 'Failed to create task.');
        } finally { setCreating(false); }
    }

    async function handleDeleteTask(id: string) {
        await tasksApi.delete(id);
        setTasks(prev => prev.filter(t => t.id !== id));
        if (expanded === id) setExpanded(null);
    }

    async function toggleExpand(taskId: string) {
        if (expanded === taskId) { setExpanded(null); return; }
        setExpanded(taskId); setClLoading(true);
        try { setChecklist(await tasksApi.getChecklist(taskId)); }
        finally { setClLoading(false); }
    }

    async function handleToggleItem(taskId: string, itemId: string, current: boolean) {
        const updated = await tasksApi.updateChecklistItem(taskId, itemId, !current);
        setChecklist(prev => prev.map(i => i.id === itemId ? { ...i, is_completed: updated.is_completed } : i));
        // Refresh task progress from backend (source of truth)
        const fresh = await tasksApi.list();
        setTasks(fresh);
    }

    async function handleAddItem(e: React.FormEvent, taskId: string) {
        e.preventDefault();
        if (!newItem.trim()) return;
        const item = await tasksApi.addChecklistItem(taskId, newItem.trim());
        setChecklist(prev => [...prev, item]);
        setNewItem('');
        const fresh = await tasksApi.list();
        setTasks(fresh);
    }

    const statusBadge = (s: Task['status']) => ({
        NOT_STARTED: <span className="badge-muted">Not started</span>,
        IN_PROGRESS: <span className="badge-info">In progress</span>,
        COMPLETED: <span className="badge-success">Completed</span>,
    }[s]);

    if (subjectsLoading || loading) return <FullPageSpinner />;
    if (error) return <div className="py-8"><ErrorBanner message={error} onRetry={load} /></div>;

    return (
        <div className="animate-slide-up max-w-2xl">
            <div className="page-header"><h1>Tasks</h1></div>

            {/* Create */}
            <div className="card mb-6">
                <p className="section-title">New Task</p>
                <form id="form-create-task" onSubmit={handleCreate} className="flex flex-col gap-3 mt-2">
                    <select
                        id="select-subject"
                        value={selectedSubject}
                        onChange={e => setSelectedSubject(e.target.value)}
                        className="w-full"
                    >
                        {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <div className="flex gap-3">
                        <input
                            id="input-task-title"
                            type="text" placeholder="Task title"
                            value={newTitle} onChange={e => setNewTitle(e.target.value)}
                            className="flex-1" maxLength={200}
                        />
                        <button id="btn-create-task" type="submit" disabled={creating} className="btn-primary">
                            {creating ? '…' : 'Add'}
                        </button>
                    </div>
                </form>
                {createError && <p className="text-xs text-amber-400 mt-2">⚠ {createError}</p>}
            </div>

            {/* List */}
            {tasks.length === 0 ? (
                <EmptyState title="No tasks yet" description="Create your first task above." />
            ) : (
                <div className="flex flex-col gap-3">
                    {tasks.map(task => (
                        <div key={task.id} className="card">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-slate-200 truncate">{task.title}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        {statusBadge(task.status)}
                                    </div>
                                    <div className="mt-2">
                                        <ProgressBar value={task.completion_percentage} label="Progress" />
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        id={`btn-expand-${task.id}`}
                                        onClick={() => toggleExpand(task.id)}
                                        className="btn-ghost btn-sm"
                                        aria-label="Toggle checklist"
                                    >
                                        {expanded === task.id ? '▲' : '▼'}
                                    </button>
                                    <button
                                        id={`btn-delete-task-${task.id}`}
                                        onClick={() => handleDeleteTask(task.id)}
                                        className="btn-ghost btn-sm text-muted hover:text-red-400"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>

                            {/* Checklist */}
                            {expanded === task.id && (
                                <div className="mt-4 pt-4 border-t border-slate-700/50 flex flex-col gap-2 animate-fade-in">
                                    {clLoading ? (
                                        <SkeletonRow count={2} />
                                    ) : checklist.length === 0 ? (
                                        <p className="text-muted text-sm">No checklist items yet.</p>
                                    ) : (
                                        checklist.map(item => (
                                            <label key={item.id} className="flex items-center gap-3 cursor-pointer group">
                                                <input
                                                    id={`check-${item.id}`}
                                                    type="checkbox"
                                                    checked={item.is_completed}
                                                    onChange={() => handleToggleItem(task.id, item.id, item.is_completed)}
                                                    className="w-4 h-4 accent-primary-500 rounded border-slate-600 bg-surface-900"
                                                />
                                                <span className={`text-sm ${item.is_completed ? 'line-through text-muted' : 'text-slate-300'}`}>
                                                    {item.label}
                                                </span>
                                            </label>
                                        ))
                                    )}
                                    <form id={`form-add-item-${task.id}`} onSubmit={e => handleAddItem(e, task.id)} className="flex gap-2 mt-2">
                                        <input
                                            id={`input-checklist-item-${task.id}`}
                                            type="text" placeholder="Add item…"
                                            value={newItem} onChange={e => setNewItem(e.target.value)}
                                            className="flex-1 text-sm py-1.5"
                                        />
                                        <button type="submit" className="btn-secondary btn-sm">+ Add</button>
                                    </form>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

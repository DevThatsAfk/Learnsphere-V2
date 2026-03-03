/**
 * SubjectsContext — Global single source of truth for the subjects list.
 *
 * Problem solved (Feature 5):
 *   Previously each page called subjectsApi.list() independently at mount.
 *   When a subject was renamed or deleted on SubjectsPage, other pages
 *   kept showing stale names until they re-mounted.
 *
 * Solution:
 *   All subject data and mutations flow through this context.
 *   Any mutation (create / rename / delete) calls refreshSubjects() so
 *   EVERY consumer gets the updated list at once — no local patches.
 */
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { subjectsApi, ApiError } from '../lib/api';
import type { Subject } from '../types/api';

// ─── Context shape ──────────────────────────────────────────────────────────
interface SubjectsContextValue {
    subjects: Subject[];
    loading: boolean;
    error: string | null;
    refreshSubjects: () => Promise<void>;
    createSubject: (name: string) => Promise<Subject>;
    renameSubject: (id: string, name: string) => Promise<Subject>;
    deleteSubject: (id: string) => Promise<void>;
}

const SubjectsContext = createContext<SubjectsContextValue | null>(null);

// ─── Provider ───────────────────────────────────────────────────────────────
export function SubjectsProvider({ children }: { children: React.ReactNode }) {
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refreshSubjects = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const list = await subjectsApi.list();
            setSubjects(list);
        } catch {
            setError('Could not load subjects.');
        } finally {
            setLoading(false);
        }
    }, []);

    // Load once on mount
    useEffect(() => { refreshSubjects(); }, [refreshSubjects]);

    // ── Mutations — each calls refreshSubjects after success ──────────────
    const createSubject = useCallback(async (name: string): Promise<Subject> => {
        const created = await subjectsApi.create(name);        // throws on error
        await refreshSubjects();                                // re-fetch list globally
        return created;
    }, [refreshSubjects]);

    const renameSubject = useCallback(async (id: string, name: string): Promise<Subject> => {
        const updated = await subjectsApi.rename(id, name);    // throws on error
        await refreshSubjects();                                // propagates to all consumers
        return updated;
    }, [refreshSubjects]);

    const deleteSubject = useCallback(async (id: string): Promise<void> => {
        await subjectsApi.delete(id);                          // throws on error
        await refreshSubjects();                                // propagates to all consumers
    }, [refreshSubjects]);

    return (
        <SubjectsContext.Provider value={{
            subjects,
            loading,
            error,
            refreshSubjects,
            createSubject,
            renameSubject,
            deleteSubject,
        }}>
            {children}
        </SubjectsContext.Provider>
    );
}

// ─── Hook ───────────────────────────────────────────────────────────────────
export function useSubjects(): SubjectsContextValue {
    const ctx = useContext(SubjectsContext);
    if (!ctx) throw new Error('useSubjects must be used within <SubjectsProvider>');
    return ctx;
}

// Re-export ApiError so consumers can do instanceof checks
export { ApiError };

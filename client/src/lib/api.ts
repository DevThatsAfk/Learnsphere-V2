/**
 * API Client — LearnSphere
 *
 * Rules (from FRONTEND_GUIDELINES.md):
 * - Backend is the ONLY source of truth
 * - No mock data
 * - All responses are typed via src/types/api.ts
 * - Token is stored in localStorage and injected per-request
 */

import axios, { AxiosError, type AxiosInstance } from 'axios';
import type {
    AuthResponse,
    Subject,
    Task,
    ChecklistItem,
    SessionStartResponse,
    StudySession,
    AnalyticsSnapshot,
    ConsistencyDay,
    TodayOverview,
    NeglectSignal,
    Exam,
    ExamMark,
    ReviewItem,
    Flashcard,
    Note,
    AIFlashcard,
    AIQuizQuestion,
} from '../types/api';

// Re-export for convenience
export type { AIFlashcard, AIQuizQuestion };

// ─── Constants ───────────────────────────────────────────────────
const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';
export const TOKEN_KEY = 'ls_token';

// ─── Axios Instance ───────────────────────────────────────────────
const http: AxiosInstance = axios.create({
    baseURL: BASE_URL,
    headers: { 'Content-Type': 'application/json' },
});

// Attach JWT on every request
http.interceptors.request.use((config) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// ─── Error Normaliser ─────────────────────────────────────────────
export class ApiError extends Error {
    status: number;
    code: string;
    constructor(message: string, status: number, code: string) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.code = code;
    }
}

function handleError(err: unknown): never {
    if (err instanceof AxiosError && err.response) {
        const { error, code } = err.response.data as { error: string; code: string };
        throw new ApiError(error ?? 'Unknown error', err.response.status, code ?? 'UNKNOWN');
    }
    throw err;
}

// ─────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────
export const authApi = {
    register: (email: string, password: string) =>
        http.post<AuthResponse>('/auth/register', { email, password })
            .then(r => r.data).catch(handleError),

    login: (email: string, password: string) =>
        http.post<AuthResponse>('/auth/login', { email, password })
            .then(r => r.data).catch(handleError),
};

// ─────────────────────────────────────────────────────────────────
// SUBJECTS
// ─────────────────────────────────────────────────────────────────
export const subjectsApi = {
    list: () =>
        http.get<Subject[]>('/subjects').then(r => r.data).catch(handleError),

    create: (name: string) =>
        http.post<Subject>('/subjects', { name }).then(r => r.data).catch(handleError),

    rename: (subjectId: string, name: string) =>
        http.patch<Subject>(`/subjects/${subjectId}`, { name }).then(r => r.data).catch(handleError),

    delete: (subjectId: string) =>
        http.delete(`/subjects/${subjectId}`).then(() => undefined).catch(handleError),
};

// ─────────────────────────────────────────────────────────────────
// TASKS
// ─────────────────────────────────────────────────────────────────
export const tasksApi = {
    list: () =>
        http.get<Task[]>('/tasks').then(r => r.data).catch(handleError),

    create: (subject_id: string, title: string) =>
        http.post<Task>('/tasks', { subject_id, title }).then(r => r.data).catch(handleError),

    delete: (taskId: string) =>
        http.delete(`/tasks/${taskId}`).then(() => undefined).catch(handleError),

    // Checklist
    getChecklist: (taskId: string) =>
        http.get<ChecklistItem[]>(`/tasks/${taskId}/checklist`).then(r => r.data).catch(handleError),

    addChecklistItem: (taskId: string, label: string) =>
        http.post<ChecklistItem>(`/tasks/${taskId}/checklist`, { label })
            .then(r => r.data).catch(handleError),

    updateChecklistItem: (taskId: string, itemId: string, is_completed: boolean) =>
        http.patch<ChecklistItem>(`/tasks/${taskId}/checklist/${itemId}`, { is_completed })
            .then(r => r.data).catch(handleError),
};

// ─────────────────────────────────────────────────────────────────
// SESSIONS
// ─────────────────────────────────────────────────────────────────
export const sessionsApi = {
    start: (subject_id: string, topic: string, session_type?: string) =>
        http.post<SessionStartResponse>('/sessions/start', { subject_id, topic, session_type })
            .then(r => r.data).catch(handleError),

    end: (sessionId: string, active_minutes: number) =>
        http.post<StudySession>(`/sessions/${sessionId}/end`, { active_minutes })
            .then(r => r.data).catch(handleError),

    review: (sessionId: string, reflection_text?: string, tags?: string[]) =>
        http.post<{ stored: boolean }>(`/sessions/${sessionId}/review`, { reflection_text, tags })
            .then(r => r.data).catch(handleError),
};

// ─────────────────────────────────────────────────────────────────
// ANALYTICS
// ─────────────────────────────────────────────────────────────────
export const analyticsApi = {
    overview: () =>
        http.get<AnalyticsSnapshot[]>('/analytics/overview').then(r => r.data).catch(handleError),

    consistency: () =>
        http.get<ConsistencyDay[]>('/analytics/consistency').then(r => r.data).catch(handleError),

    today: () =>
        http.get<TodayOverview>('/analytics/today').then(r => r.data).catch(handleError),

    neglect: () =>
        http.get<NeglectSignal[]>('/analytics/neglect').then(r => r.data).catch(handleError),
};

// ─────────────────────────────────────────────────────────────────
// EXAMS
// ─────────────────────────────────────────────────────────────────
export const examsApi = {
    list: () =>
        http.get<Exam[]>('/exams').then(r => r.data).catch(handleError),

    create: (title: string, exam_date: string) =>
        http.post<Exam>('/exams', { title, exam_date }).then(r => r.data).catch(handleError),

    getMarks: (examId: string) =>
        http.get<ExamMark[]>(`/exams/${examId}/marks`).then(r => r.data).catch(handleError),

    addMarks: (examId: string, marks: ExamMark[]) =>
        http.post<{ stored: boolean }>(`/exams/${examId}/marks`, marks)
            .then(r => r.data).catch(handleError),
};

// ─────────────────────────────────────────────────────────────────
// REVIEWS
// ─────────────────────────────────────────────────────────────────
export const reviewsApi = {
    queue: () =>
        http.get<ReviewItem[]>('/reviews').then(r => r.data).catch(handleError),

    create: (subject_id: string, topic: string) =>
        http.post<ReviewItem>('/reviews', { subject_id, topic }).then(r => r.data).catch(handleError),

    getFlashcards: (reviewId: string) =>
        http.get<Flashcard[]>(`/reviews/${reviewId}/flashcards`).then(r => r.data).catch(handleError),

    addFlashcard: (reviewId: string, question: string, answer: string) =>
        http.post<Flashcard>(`/reviews/${reviewId}/flashcards`, { question, answer })
            .then(r => r.data).catch(handleError),

    submitResult: (reviewId: string, cardId: string, recall_strength: string) =>
        http.post<{ stored: boolean; recall_strength: string }>(
            `/reviews/${reviewId}/flashcards/${cardId}`,
            { recall_strength }
        ).then(r => r.data).catch(handleError),
};

// ─────────────────────────────────────────────────────────────────
// SUMMARIZER  (Feature 4 — stateless, no auto-save)
// ─────────────────────────────────────────────────────────────────
export const summarizeApi = {
    summarize: (text: string) =>
        http.post<{ summary: string }>('/summarize', { text })
            .then(r => r.data).catch(handleError),
};

// ─────────────────────────────────────────────────────────────────
// NOTES  (Feature 2 — user-authored study notes, never AI-modified)
// ─────────────────────────────────────────────────────────────────
export const notesApi = {
    /** List notes for a subject, optionally filtered to a topic */
    list: (subjectId: string, topic?: string) => {
        const params: Record<string, string> = { subjectId };
        if (topic) params['topic'] = topic;
        return http.get<Note[]>('/notes', { params }).then(r => r.data).catch(handleError);
    },

    create: (subjectId: string, content: string, topic?: string) =>
        http.post<Note>('/notes', { subjectId, content, topic })
            .then(r => r.data).catch(handleError),

    update: (noteId: string, content: string) =>
        http.patch<Note>(`/notes/${noteId}`, { content })
            .then(r => r.data).catch(handleError),

    delete: (noteId: string) =>
        http.delete(`/notes/${noteId}`).then(() => undefined).catch(handleError),
};

// ─────────────────────────────────────────────────────────────────
// GENERATION (Feature 3 — AI content from notes + file uploads)
// Types are defined in types/api.ts and re-exported above.
// ─────────────────────────────────────────────────────────────────
export interface AISuggestedCard {
    question: string;
    answer: string;
}

export const generateApi = {
    /** Generate flashcards grounded in note content */
    flashcards: (notes: string) =>
        http.post<AIFlashcard[]>('/generate/flashcards', { notes })
            .then(r => r.data).catch(handleError),

    /** Generate a quiz grounded in note content */
    quiz: (notes: string) =>
        http.post<AIQuizQuestion[]>('/generate/quiz', { notes })
            .then(r => r.data).catch(handleError),
};

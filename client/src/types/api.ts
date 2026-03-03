// ─────────────────────────────────────────────────────────────────
// API Response Types — mirrors API_CONTRACTS.md exactly
// These are the shapes returned by the backend. Frontend MUST NOT
// derive or transform analytics — display only what the API returns.
// ─────────────────────────────────────────────────────────────────

// Auth
export interface AuthResponse {
    token: string;
}

// Subjects
export interface Subject {
    id: string;
    name: string;
}

// Tasks
export type TaskStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export interface Task {
    id: string;
    title: string;
    subject_id: string;
    status: TaskStatus;
    completion_percentage: number;
}

// Checklist
export interface ChecklistItem {
    id: string;
    label: string;
    is_completed: boolean;
}

// Sessions
export type SessionType = 'STUDY' | 'REVISION';

export interface SessionStartResponse {
    id: string;
    start_time: string; // ISO 8601
}

export interface StudySession {
    id: string;
    subject_id: string;
    topic: string;
    session_type: SessionType;
    active_minutes: number;
    start_time: string;
    end_time: string | null;
}

// Analytics
export interface AnalyticsSnapshot {
    subject_id: string;
    total_active_minutes: number;
    average_marks: number | null;
}

export interface ConsistencyDay {
    date: string; // YYYY-MM-DD
    active_minutes: number;
    is_active: boolean;
}

export interface TodayOverview {
    total_active_minutes: number;
    sessions_count: number;
}

export interface NeglectSignal {
    subject_id: string;
    days_since_last_activity: number;
}

// Exams
export interface Exam {
    id: string;
    title: string;
    exam_date: string; // YYYY-MM-DD
}

export interface ExamMark {
    subject_id: string;
    marks: number;
}

// Reviews
export type RecallStrength = 'WEAK' | 'MODERATE' | 'STRONG';

export interface ReviewItem {
    review_id: string;
    subject_id: string;
    topic: string;
    recall_strength: RecallStrength;
}

export interface Flashcard {
    card_id: string;
    question: string;
}

// API Error shape
export interface ApiErrorResponse {
    error: string;
    code: string;
}

// Study Notes (Feature 2)
export interface Note {
    id: string;
    userId: string;
    subjectId: string;
    topic: string | null;
    content: string;
    createdAt: string;
    updatedAt: string;
}

// AI Generated Content (Feature 3 — File Upload + Anti-Hallucination)
export interface AIFlashcard {
    question: string;
    answer: string;
}

export interface AIQuizQuestion {
    question: string;
    options: string[]; // Always exactly 4 items
    correctAnswer: number; // 0-based index into options[]
    explanation?: string;
}

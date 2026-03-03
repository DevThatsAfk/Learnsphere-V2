import { z } from 'zod';

// ─── Flashcard Schema ───────────────────────────────────────────
export const FlashcardSchema = z.object({
    question: z.string().min(5).max(500),
    answer: z.string().min(3).max(1000),
});

export const FlashcardsResponseSchema = z.object({
    flashcards: z.array(FlashcardSchema).min(1).max(10),
});

// ─── Quiz Schema ────────────────────────────────────────────────
export const QuizQuestionSchema = z.object({
    question: z.string().min(5).max(500),
    options: z.array(z.string().min(1).max(200)).length(4),
    correctAnswer: z.number().min(0).max(3), // 0-based index into options[]
    explanation: z.string().max(500).optional(),
});

export const QuizResponseSchema = z.object({
    questions: z.array(QuizQuestionSchema).min(1).max(5),
});

// ─── Exported Types ─────────────────────────────────────────────
export type AIFlashcard = z.infer<typeof FlashcardSchema>;
export type AIQuizQuestion = z.infer<typeof QuizQuestionSchema>;

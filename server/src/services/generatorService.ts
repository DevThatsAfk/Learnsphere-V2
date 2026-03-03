/**
 * generatorService.ts — AI generation for flashcards and quizzes.
 *
 * Rules:
 *  - GROUNDING: Flashcards MUST be generated only from the provided context (notes).
 *  - No external knowledge or hallucinations.
 *  - Output validated via Zod schemas before returning.
 *  - Stateless: No data persisted by AI.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ApiError } from '../middleware/errorHandler';
import { FlashcardsResponseSchema, QuizResponseSchema } from '../schemas/aiSchemas';

const MODEL_NAME = 'gemini-1.5-flash';

// ─── Generate Flashcards from Note Content ────────────────────────
export async function generateFlashcardsFromNotes(noteContent: string) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new ApiError(503, 'AI Generator not configured.', 'GENERATOR_NOT_CONFIGURED');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: MODEL_NAME,
        generationConfig: { responseMimeType: 'application/json' },
    });

    const prompt = `
        You are an academic flashcard generator. Extract exactly 5 high-quality flashcards from the text.

        STRICT RULES:
        1. Use ONLY information from the provided text — no outside knowledge.
        2. Return a JSON object with a "flashcards" array.
        3. Each flashcard must have "question" and "answer" string fields.
        4. Keep answers concise (1 sentence max).

        TEXT CONTENT:
        """
        ${noteContent}
        """

        REQUIRED JSON FORMAT:
        { "flashcards": [{ "question": "string", "answer": "string" }] }
    `;

    try {
        const result = await model.generateContent(prompt);
        const raw = JSON.parse(result.response.text());

        // Bug 5 fix: Zod validation — reject malformed AI output
        const validated = FlashcardsResponseSchema.safeParse(raw);
        if (!validated.success) {
            console.error('[AI_VALIDATION]', validated.error.message);
            throw new ApiError(500, 'AI returned invalid flashcard structure. Please try again.', 'AI_VALIDATION_ERROR');
        }
        return validated.data.flashcards.slice(0, 5);
    } catch (error) {
        if (error instanceof ApiError) throw error;
        console.error('[AI_GEN_ERROR]', error);
        throw new ApiError(500, 'Failed to generate flashcards from notes.', 'GENERATION_FAILED');
    }
}

// ─── Generate Quiz from Note Content ────────────────────────────
export async function generateQuizFromNotes(noteContent: string) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new ApiError(503, 'AI Generator not configured.', 'GENERATOR_NOT_CONFIGURED');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: MODEL_NAME,
        generationConfig: { responseMimeType: 'application/json' },
    });

    // Bug 1 fix: correctAnswer is now a 0-based NUMBER index, not a "correct": string
    const prompt = `
        You are an academic quiz generator. Extract exactly 3 multiple-choice questions from the text.

        STRICT RULES:
        1. Use ONLY information from the provided text — no outside knowledge.
        2. Return a JSON object with a "questions" array.
        3. Each question must have exactly 4 options in the "options" array.
        4. "correctAnswer" is the 0-based INDEX (0, 1, 2, or 3) of the correct option.
        5. Include a brief "explanation" referencing the source text.

        TEXT CONTENT:
        """
        ${noteContent}
        """

        REQUIRED JSON FORMAT:
        { "questions": [{ "question": "string", "options": ["A","B","C","D"], "correctAnswer": 0, "explanation": "string" }] }
    `;

    try {
        const result = await model.generateContent(prompt);
        const raw = JSON.parse(result.response.text());

        // Bug 1+5 fix: Zod validates correctAnswer is a number in range 0-3
        const validated = QuizResponseSchema.safeParse(raw);
        if (!validated.success) {
            console.error('[AI_VALIDATION]', validated.error.message);
            throw new ApiError(500, 'AI returned invalid quiz structure. Please try again.', 'AI_VALIDATION_ERROR');
        }
        return validated.data.questions.slice(0, 3);
    } catch (error) {
        if (error instanceof ApiError) throw error;
        console.error('[AI_GEN_ERROR]', error);
        throw new ApiError(500, 'Failed to generate quiz from notes.', 'GENERATION_FAILED');
    }
}

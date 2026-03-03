/**
 * generatorService.ts — AI generation for flashcards and quizzes.
 *
 * Rules:
 *  - GROUNDING: Flashcards MUST be generated only from the provided context (notes).
 *  - No external knowledge or hallucinations.
 *  - Output format: Strict JSON schemas.
 *  - Stateless: No data persisted by AI.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ApiError } from '../middleware/errorHandler';

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
        You are an academic flashcard generator. Your task is to extract exactly 5 high-quality flashcards from the text provided.
        
        STRICT RULES:
        1. GROUNDING: Base the questions and answers ONLY on the provided text. Do not add outside information.
        2. STRUCTURE: Return a JSON array of objects. Each object must have "question" and "answer" fields.
        3. NO ESSAYS: Keep questions and answers concise (maximum 1 sentence each).
        4. Focus on key definitions, dates, concepts, or formulas present in the text.
        
        TEXT CONTENT:
        """
        ${noteContent}
        """
        
        REQUIRED JSON SCHEMA:
        [{ "question": "string", "answer": "string" }]
    `;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const cards = JSON.parse(text);

        if (!Array.isArray(cards)) throw new Error('Invalid AI response structure.');
        return cards.slice(0, 5); // Return exactly 5
    } catch (error) {
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

    const prompt = `
        You are an academic quiz generator. Your task is to extract exactly 3 multiple-choice questions from the text provided.
        
        STRICT RULES:
        1. GROUNDING: Base the questions and options ONLY on the provided text.
        2. STRUCTURE: Return a JSON array of objects.
        3. Options: Each question must have exactly 4 options.
        
        TEXT CONTENT:
        """
        ${noteContent}
        """
        
        REQUIRED JSON SCHEMA:
        [{ "id": "number", "question": "string", "options": ["string", "string", "string", "string"], "correct": "string" }]
    `;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const quiz = JSON.parse(text);
        if (!Array.isArray(quiz)) throw new Error('Invalid AI response structure.');
        return quiz.slice(0, 3);
    } catch (error) {
        console.error('[AI_GEN_ERROR]', error);
        throw new ApiError(500, 'Failed to generate quiz from notes.', 'GENERATION_FAILED');
    }
}

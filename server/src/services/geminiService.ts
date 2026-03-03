/**
 * geminiService.ts — AI generation with strict anti-hallucination prompts.
 *
 * Rules:
 *  - STRICT_GROUNDING_INSTRUCTION is injected into every call.
 *  - Every Gemini response is validated through Zod before use.
 *  - Files are passed as base64 inlineData (buffer → Gemini, never disk).
 *  - Text files are embedded directly in the prompt string (capped at 50,000 chars).
 */
import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import { ApiError } from '../middleware/errorHandler';
import {
    FlashcardsResponseSchema,
    QuizResponseSchema,
} from '../schemas/aiSchemas';
import type { AIFlashcard, AIQuizQuestion } from '../schemas/aiSchemas';

const MODEL_NAME = 'gemini-1.5-flash';

function getModel() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new ApiError(503, 'AI service not configured. Add GEMINI_API_KEY to server/.env', 'GENERATOR_NOT_CONFIGURED');
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({ model: MODEL_NAME });
}

// ─────────────────────────────────────────────────────────────
// ANTI-HALLUCINATION SYSTEM PROMPT
// Injected at the start of EVERY AI call.
// ─────────────────────────────────────────────────────────────
const STRICT_GROUNDING_INSTRUCTION = `
CRITICAL RULES — YOU MUST FOLLOW THESE WITHOUT EXCEPTION:
1. You may ONLY use information that appears in the SOURCE MATERIAL provided below.
2. Do NOT add any external knowledge, examples, or facts not present in the source.
3. Do NOT invent questions or answers. If the source is too short, generate fewer items.
4. Respond ONLY with valid JSON matching the exact schema specified. No markdown, no preamble, no explanation.
5. If you cannot generate valid content from the source alone, return the minimum valid JSON (e.g., 1 flashcard).
`;

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function fileToGeminiPart(buffer: Buffer, mimeType: string): Part {
    return {
        inlineData: {
            data: buffer.toString('base64'),
            mimeType,
        },
    };
}

function parseAndClean(rawText: string): unknown {
    // Strip any ```json ... ``` fences Gemini might add despite instructions
    const cleaned = rawText.trim()
        .replace(/^```json\n?/, '')
        .replace(/\n?```$/, '');
    return JSON.parse(cleaned);
}

// ─────────────────────────────────────────────────────────────
// GENERATE FLASHCARDS from file upload (PDF / image / text)
// ─────────────────────────────────────────────────────────────
export async function generateFlashcardsFromFile(
    fileBuffer: Buffer,
    mimeType: string,
    count: number = 5
): Promise<AIFlashcard[]> {
    const model = getModel();

    const promptText = `${STRICT_GROUNDING_INSTRUCTION}

SOURCE MATERIAL:
[See the attached file/image below — this is your ONLY allowed source]

TASK: Generate exactly ${count} flashcards from the source material.

REQUIRED JSON FORMAT (respond with ONLY this JSON, nothing else):
{
  "flashcards": [
    { "question": "...", "answer": "..." }
  ]
}`;

    let parts: Part[];

    if (mimeType === 'text/plain') {
        const textContent = fileBuffer.toString('utf-8').slice(0, 50000);
        parts = [{ text: `${promptText}\n\nSOURCE TEXT:\n"""\n${textContent}\n"""` }];
    } else {
        parts = [{ text: promptText }, fileToGeminiPart(fileBuffer, mimeType)];
    }

    const result = await model.generateContent(parts);

    let parsed: unknown;
    try {
        parsed = parseAndClean(result.response.text());
    } catch {
        throw new ApiError(500, 'AI returned invalid JSON for flashcards. Please try again.', 'AI_PARSE_ERROR');
    }

    const validated = FlashcardsResponseSchema.safeParse(parsed);
    if (!validated.success) {
        throw new ApiError(500, `AI output failed validation: ${validated.error.message}`, 'AI_VALIDATION_ERROR');
    }

    return validated.data.flashcards;
}

// ─────────────────────────────────────────────────────────────
// GENERATE QUIZ from file upload (PDF / image / text)
// ─────────────────────────────────────────────────────────────
export async function generateQuizFromFile(
    fileBuffer: Buffer,
    mimeType: string,
    count: number = 3
): Promise<AIQuizQuestion[]> {
    const model = getModel();

    const promptText = `${STRICT_GROUNDING_INSTRUCTION}

SOURCE MATERIAL:
[See the attached file/image below — this is your ONLY allowed source]

TASK: Generate exactly ${count} multiple-choice questions from the source material.

REQUIRED JSON FORMAT (respond with ONLY this JSON, nothing else):
{
  "questions": [
    {
      "question": "...",
      "options": ["option A", "option B", "option C", "option D"],
      "correctAnswer": 0,
      "explanation": "Brief reason why this is correct, using only source material."
    }
  ]
}

RULES FOR MCQs:
- "correctAnswer" is the 0-based INDEX of the correct option in the "options" array.
- All 4 options must be plausible (no obviously wrong answers).
- Questions must be answerable ONLY from the source — not from general knowledge.`;

    let parts: Part[];

    if (mimeType === 'text/plain') {
        const textContent = fileBuffer.toString('utf-8').slice(0, 50000);
        parts = [{ text: `${promptText}\n\nSOURCE TEXT:\n"""\n${textContent}\n"""` }];
    } else {
        parts = [{ text: promptText }, fileToGeminiPart(fileBuffer, mimeType)];
    }

    const result = await model.generateContent(parts);

    let parsed: unknown;
    try {
        parsed = parseAndClean(result.response.text());
    } catch {
        throw new ApiError(500, 'AI returned invalid JSON for quiz. Please try again.', 'AI_PARSE_ERROR');
    }

    const validated = QuizResponseSchema.safeParse(parsed);
    if (!validated.success) {
        throw new ApiError(500, `AI quiz output failed validation: ${validated.error.message}`, 'AI_VALIDATION_ERROR');
    }

    return validated.data.questions;
}

// ─────────────────────────────────────────────────────────────
// GENERATE FLASHCARDS from notes text (existing text flow)
// Now upgraded with Zod validation and strict grounding.
// ─────────────────────────────────────────────────────────────
export async function generateFlashcardsFromText(noteContent: string): Promise<AIFlashcard[]> {
    const model = getModel();

    const prompt = `${STRICT_GROUNDING_INSTRUCTION}

SOURCE TEXT:
"""
${noteContent.slice(0, 20000)}
"""

TASK: Generate 5 flashcards based ONLY on the source text above.

REQUIRED JSON FORMAT:
{
  "flashcards": [
    { "question": "...", "answer": "..." }
  ]
}`;

    const result = await model.generateContent(prompt);

    let parsed: unknown;
    try {
        parsed = parseAndClean(result.response.text());
    } catch {
        throw new ApiError(500, 'AI returned invalid JSON. Please try again.', 'AI_PARSE_ERROR');
    }

    const validated = FlashcardsResponseSchema.safeParse(parsed);
    if (!validated.success) {
        throw new ApiError(500, `AI output failed validation: ${validated.error.message}`, 'AI_VALIDATION_ERROR');
    }

    return validated.data.flashcards;
}

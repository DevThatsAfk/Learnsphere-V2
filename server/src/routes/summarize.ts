import { Router } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { authenticateToken } from '../middleware/auth';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import { aiRateLimit } from '../middleware/aiRateLimit';

const router = Router();
router.use(authenticateToken);
router.use(aiRateLimit); // Bug 2 fix: runs after auth, userId is set

/**
 * POST /api/summarize
 *
 * Constraints (spec: FEATURE 4 — Context Summarizer):
 * - Input: user-provided text ONLY. No extra context injected.
 * - Output: shorter version ONLY. No added information.
 * - Stateless: nothing is stored.
 * - User must explicitly save on the frontend — this route never persists.
 * - If GEMINI_API_KEY is not set, returns 503 with a clear error.
 *
 * Body:  { text: string }
 * Returns: { summary: string }
 */
router.post(
    '/',
    asyncHandler(async (req, res) => {
        const { text } = req.body as { text?: string };

        if (!text || text.trim().length === 0) {
            throw new ApiError(400, 'text is required.', 'MISSING_TEXT');
        }
        if (text.trim().length < 30) {
            throw new ApiError(400, 'Text must be at least 30 characters to summarise.', 'TEXT_TOO_SHORT');
        }
        if (text.length > 10_000) {
            throw new ApiError(400, 'Text must be 10,000 characters or fewer.', 'TEXT_TOO_LONG');
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new ApiError(
                503,
                'Summarizer is not configured. Add GEMINI_API_KEY to the server .env file.',
                'SUMMARIZER_NOT_CONFIGURED'
            );
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        // Tightly constrained system instruction — summarise ONLY, do not add information
        const systemInstruction = [
            'You are a text summariser. Your only job is to produce a shorter version of the text the user provides.',
            'Rules you MUST follow:',
            '1. Output ONLY the summary — no preamble, no commentary, no "Here is a summary:" prefix.',
            '2. Do not add any information not present in the input text.',
            '3. Do not answer questions, give advice, or interpret the text.',
            '4. Preserve the meaning and key points of the original.',
            '5. Output plain text only — no markdown, no bullet points unless the input already used them.',
        ].join('\n');

        const result = await model.generateContent({
            systemInstruction,
            contents: [{ role: 'user', parts: [{ text: text.trim() }] }],
        });

        const summary = result.response.text().trim();

        if (!summary) {
            throw new ApiError(500, 'Summariser returned an empty response.', 'EMPTY_RESPONSE');
        }

        // Stateless — return only. Nothing is persisted.
        res.json({ summary });
    })
);

export default router;

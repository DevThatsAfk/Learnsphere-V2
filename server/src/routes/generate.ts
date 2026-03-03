/**
 * POST /api/generate/flashcards — Generate flashcards from notes
 * POST /api/generate/quiz       — Generate quiz from notes
 *
 * Grounding Rule: text must be provided in body.
 */
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import {
    generateFlashcardsFromNotes,
    generateQuizFromNotes,
} from '../services/generatorService';

const router = Router();
router.use(authenticateToken);

router.post(
    '/flashcards',
    asyncHandler(async (req, res) => {
        const { notes } = req.body as { notes: string };
        if (!notes || notes.trim().length < 50) {
            throw new ApiError(400, 'Please provide more detailed notes (min 50 chars) to generate flashcards.', 'INSUFFICIENT_NOTES');
        }
        const cards = await generateFlashcardsFromNotes(notes);
        res.json(cards);
    }),
);

router.post(
    '/quiz',
    asyncHandler(async (req, res) => {
        const { notes } = req.body as { notes: string };
        if (!notes || notes.trim().length < 50) {
            throw new ApiError(400, 'Please provide more detailed notes (min 50 chars) to generate a quiz.', 'INSUFFICIENT_NOTES');
        }
        const quiz = await generateQuizFromNotes(notes);
        res.json(quiz);
    }),
);

export default router;

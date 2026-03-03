/**
 * GET  /api/notes?subjectId=&topic=   — list notes for a subject
 * POST /api/notes                      — create a note
 * PATCH /api/notes/:noteId             — update note content
 * DELETE /api/notes/:noteId            — delete a note
 *
 * All routes are auth-protected. Ownership verified in service layer.
 */
import { Router, Request } from 'express';
import { authenticateToken } from '../middleware/auth';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import {
    getNotesForSubject,
    createNote,
    updateNote,
    deleteNote,
} from '../services/noteService';

interface AuthenticatedRequest extends Request {
    userId?: string;
}

const router = Router();
router.use(authenticateToken);

// ─── GET /api/notes?subjectId=&topic= ────────────────────────────
router.get(
    '/',
    asyncHandler(async (req: AuthenticatedRequest, res) => {
        const userId = req.userId!;
        const subjectId = req.query['subjectId'] as string | undefined;
        const topic = req.query['topic'] as string | undefined;

        if (!subjectId) throw new ApiError(400, 'subjectId query param is required.', 'MISSING_PARAM');

        const notes = await getNotesForSubject(userId, subjectId, topic);
        res.json(notes);
    }),
);

// ─── POST /api/notes ─────────────────────────────────────────────
router.post(
    '/',
    asyncHandler(async (req: AuthenticatedRequest, res) => {
        const userId = req.userId!;
        const { subjectId, topic, content } = req.body as {
            subjectId: string;
            topic?: string;
            content: string;
        };

        if (!subjectId) throw new ApiError(400, 'subjectId is required.', 'MISSING_FIELD');
        if (typeof content !== 'string') throw new ApiError(400, 'content must be a string.', 'INVALID_FIELD');
        if (content.length > 20_000) throw new ApiError(400, 'Note content exceeds 20,000 chars.', 'TOO_LONG');

        const note = await createNote({ userId, subjectId, topic, content: content.trim() });
        res.status(201).json(note);
    }),
);

// ─── PATCH /api/notes/:noteId ─────────────────────────────────────
router.patch(
    '/:noteId',
    asyncHandler(async (req: AuthenticatedRequest, res) => {
        const userId = req.userId!;
        const noteId = String(req.params.noteId);
        const { content } = req.body as { content: string };

        if (typeof content !== 'string') throw new ApiError(400, 'content must be a string.', 'INVALID_FIELD');
        if (content.length > 20_000) throw new ApiError(400, 'Note content exceeds 20,000 chars.', 'TOO_LONG');

        const note = await updateNote(noteId, userId, content.trim());
        res.json(note);
    }),
);

// ─── DELETE /api/notes/:noteId ────────────────────────────────────
router.delete(
    '/:noteId',
    asyncHandler(async (req: AuthenticatedRequest, res) => {
        const userId = req.userId!;
        const noteId = String(req.params.noteId);

        await deleteNote(noteId, userId);
        res.status(204).send();
    }),
);

export default router;

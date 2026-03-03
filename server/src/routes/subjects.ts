import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import { getSubjectsForUser, createSubject, deleteSubject, renameSubject } from '../services/subjectService';

const router = Router();
router.use(authenticateToken);

/**
 * GET /api/subjects
 * Returns all subjects for the authenticated user.
 * Response: Subject[]  — { id, name }
 */
router.get(
    '/',
    asyncHandler(async (req: AuthenticatedRequest, res) => {
        const userId = req.userId!;
        const subjects = await getSubjectsForUser(userId);
        res.json(subjects);
    })
);

/**
 * POST /api/subjects
 * Body: { name: string }
 * Response: 201 + Subject — { id, name }
 */
router.post(
    '/',
    asyncHandler(async (req: AuthenticatedRequest, res) => {
        const userId = req.userId!;
        const { name } = req.body as { name: string };
        const subject = await createSubject({ name, userId });
        res.status(201).json(subject);
    })
);

/**
 * PATCH /api/subjects/:subjectId
 * Rename a subject. Ownership + uniqueness enforced in service.
 * Body: { name: string }
 * Response: 200 + Subject — { id, name }
 */
router.patch(
    '/:subjectId',
    asyncHandler(async (req: AuthenticatedRequest, res) => {
        const userId = req.userId!;
        const subjectId = req.params['subjectId'] as string;
        if (!subjectId) throw new ApiError(400, 'Subject ID required.', 'MISSING_ID');
        const { name } = req.body as { name: string };
        const updated = await renameSubject(subjectId, name, userId);
        res.json(updated);
    })
);

/**
 * DELETE /api/subjects/:subjectId
 * Deletes subject and all related data (cascades via Prisma).
 * Response: 204 No Content
 */
router.delete(
    '/:subjectId',
    asyncHandler(async (req: AuthenticatedRequest, res) => {
        const userId = req.userId!;
        const subjectId = req.params['subjectId'] as string;
        if (!subjectId) throw new ApiError(400, 'Subject ID required.', 'MISSING_ID');
        await deleteSubject(subjectId, userId);
        res.status(204).send();
    })
);

export default router;

import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import { startSession, endSession, submitSessionReview } from '../services/sessionService';

const router = Router();
router.use(authenticateToken);

/**
 * POST /api/sessions/start
 * Body: { subject_id: string, topic: string, session_type?: "STUDY" | "REVISION" }
 * Response: 200 + SessionStartResponse — { id, start_time }
 *
 * start_time is set by the server. Client time is never trusted.
 */
router.post(
    '/start',
    asyncHandler(async (req: AuthenticatedRequest, res) => {
        const userId = req.userId!;
        const {
            subject_id,
            topic,
            session_type,
        } = req.body as { subject_id: string; topic: string; session_type?: string };

        if (!subject_id) throw new ApiError(400, 'subject_id is required.', 'MISSING_SUBJECT_ID');
        if (!topic) throw new ApiError(400, 'topic is required.', 'MISSING_TOPIC');

        const result = await startSession({ subjectId: subject_id, topic, sessionType: session_type, userId });
        res.status(200).json(result);
    })
);

/**
 * POST /api/sessions/:sessionId/end
 * Body: { active_minutes: number }
 * Response: 200 + StudySession — { id, subject_id, topic, session_type, active_minutes, start_time, end_time }
 *
 * end_time is set by the server. active_minutes is client-reported (1–1440).
 */
router.post(
    '/:sessionId/end',
    asyncHandler(async (req: AuthenticatedRequest, res) => {
        const userId = req.userId!;
        const sessionId = req.params['sessionId'] as string;
        const { active_minutes } = req.body as { active_minutes: number };

        if (active_minutes === undefined || active_minutes === null) {
            throw new ApiError(400, 'active_minutes is required.', 'MISSING_MINUTES');
        }

        const result = await endSession({ sessionId, activeMinutes: active_minutes, userId });
        res.status(200).json(result);
    })
);

/**
 * POST /api/sessions/:sessionId/review
 * Body: { reflection_text?: string, tags?: string[] }
 * Response: 201 Stored
 *
 * Session must already be ended. Review can only be submitted once.
 */
router.post(
    '/:sessionId/review',
    asyncHandler(async (req: AuthenticatedRequest, res) => {
        const userId = req.userId!;
        const sessionId = req.params['sessionId'] as string;
        const {
            reflection_text,
            tags,
        } = req.body as { reflection_text?: string; tags?: string[] };

        await submitSessionReview({ sessionId, reflectionText: reflection_text, tags, userId });
        res.status(201).json({ stored: true });
    })
);

export default router;

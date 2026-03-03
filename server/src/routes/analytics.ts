import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import {
    getAnalyticsOverview,
    getConsistencyCalendar,
    getTodayOverview,
    getNeglectSignals,
} from '../services/analyticsService';

const router = Router();
router.use(authenticateToken);

/**
 * GET /api/analytics/overview
 * Subject-wise: total_active_minutes + average_marks
 * Response: AnalyticsSnapshot[]
 */
router.get(
    '/overview',
    asyncHandler(async (req: AuthenticatedRequest, res) => {
        const userId = req.userId!;
        const data = await getAnalyticsOverview(userId);
        res.json(data);
    })
);

/**
 * GET /api/analytics/consistency
 * Last 30 days: date, active_minutes, is_active
 * Active = total_active_minutes >= 18 for that day
 * Response: ConsistencyDay[]
 */
router.get(
    '/consistency',
    asyncHandler(async (req: AuthenticatedRequest, res) => {
        const userId = req.userId!;
        const data = await getConsistencyCalendar(userId);
        res.json(data);
    })
);

/**
 * GET /api/analytics/today
 * Current day: total_active_minutes + sessions_count
 * Response: TodayOverview
 */
router.get(
    '/today',
    asyncHandler(async (req: AuthenticatedRequest, res) => {
        const userId = req.userId!;
        const data = await getTodayOverview(userId);
        res.json(data);
    })
);

/**
 * GET /api/analytics/neglect
 * Subjects with no activity for >= 14 days
 * Response: NeglectSignal[] — { subject_id, days_since_last_activity }
 */
router.get(
    '/neglect',
    asyncHandler(async (req: AuthenticatedRequest, res) => {
        const userId = req.userId!;
        const data = await getNeglectSignals(userId);
        res.json(data);
    })
);

export default router;

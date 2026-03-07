/**
 * routes/risk.ts — Risk score endpoints.
 * Full implementation in Phase 2 (riskEngine.ts).
 * These stubs return structured responses so the server compiles now.
 */
import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roleGuard';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import { prisma } from '../prisma/client';
import { calculateRisk } from '../services/riskEngine';
import { notifyStudentRedRisk } from '../services/notificationService';

const router = Router();
router.use(authenticateToken);

/** GET /api/risk/me — student's own latest risk score */
router.get('/me', asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.userId!;
    const score = await prisma.riskScore.findFirst({
        where: { userId },
        orderBy: { calculatedAt: 'desc' },
        include: { flags: true },
    });
    if (!score) {
        return res.json({ score: null, message: 'No risk score calculated yet. Trigger /me/calculate first.' });
    }
    res.json(score);
}));

/** POST /api/risk/me/calculate — student triggers self recalculation */
router.post('/me/calculate', asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.userId!;
    const result = await calculateRisk(userId);
    // Notify parents/advisors on RED
    if (result.level === 'RED' && result.flags.length > 0) {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
        notifyStudentRedRisk(userId, user?.email ?? userId, result.score, result.flags[0].detail).catch(() => { });
    }
    res.json(result);
}));

/** GET /api/risk/cohort — all students sorted by risk */
router.get('/cohort', requireRole(['EDUCATOR', 'HOD', 'ADMIN']), asyncHandler(async (_req, res) => {
    const scores = await prisma.riskScore.findMany({
        orderBy: [{ level: 'asc' }, { score: 'desc' }],
        include: { user: { select: { id: true, email: true, rollNumber: true } }, flags: true },
        distinct: ['userId'],
    });
    res.json(scores);
}));

/** GET /api/risk/:studentId — full risk breakdown for one student */
router.get('/:studentId', requireRole(['EDUCATOR', 'HOD', 'ADMIN', 'ADVISOR']), asyncHandler(async (req, res) => {
    const studentId = String(req.params.studentId);
    const scores = await prisma.riskScore.findMany({
        where: { userId: studentId },
        orderBy: { calculatedAt: 'desc' },
        take: 10,
        include: { flags: true },
    });
    if (!scores.length) throw new ApiError(404, 'No risk data for this student.', 'NOT_FOUND');
    res.json(scores);
}));

/** POST /api/risk/:studentId/calculate — force recalculate */
router.post('/:studentId/calculate', requireRole(['EDUCATOR', 'HOD', 'ADMIN']), asyncHandler(async (req, res) => {
    const studentId = String(req.params.studentId);
    const student = await prisma.user.findUnique({ where: { id: studentId }, select: { id: true } });
    if (!student) throw new ApiError(404, 'Student not found.', 'NOT_FOUND');
    const result = await calculateRisk(studentId);
    if (result.level === 'RED' && result.flags.length > 0) {
        const user = await prisma.user.findUnique({ where: { id: studentId }, select: { email: true } });
        notifyStudentRedRisk(studentId, user?.email ?? studentId, result.score, result.flags[0].detail).catch(() => { });
    }
    res.json(result);
}));

export default router;

/**
 * routes/interventions.ts — Intervention lifecycle endpoints.
 * Full implementation in Phase 3 (interventionService.ts).
 */
import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roleGuard';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import { prisma } from '../prisma/client';
import { createIntervention, approveIntervention, process7DayFollowUps } from '../services/interventionService';

const router = Router();
router.use(authenticateToken);

/** POST /api/interventions — EDUCATOR creates intervention (with optional AI draft) */
router.post('/', requireRole(['EDUCATOR']), asyncHandler(async (req: AuthenticatedRequest, res) => {
    const educatorId = req.userId!;
    const { studentId, riskScoreId, educatorNote, useAIDraft } = req.body as {
        studentId: string;
        riskScoreId: string;
        educatorNote?: string;
        useAIDraft?: boolean;
    };
    if (!studentId || !riskScoreId) throw new ApiError(400, 'studentId and riskScoreId are required.', 'MISSING_FIELDS');

    const intervention = await createIntervention({ studentId, educatorId, riskScoreId, educatorNote, useAIDraft });
    res.status(201).json(intervention);
}));

/** GET /api/interventions/pending — EDUCATOR + HOD */
router.get('/pending', requireRole(['EDUCATOR', 'HOD']), asyncHandler(async (_req, res) => {
    const pending = await prisma.intervention.findMany({
        where: { status: 'PENDING_REVIEW' },
        orderBy: { createdAt: 'desc' },
        include: {
            student: { select: { id: true, email: true, rollNumber: true } },
            educator: { select: { id: true, email: true } },
        },
    });
    res.json(pending);
}));

/** GET /api/interventions/mine — STUDENT sees their interventions */
router.get('/mine', asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.userId!;
    const interventions = await prisma.intervention.findMany({
        where: { studentId, status: { in: ['APPROVED', 'MODIFIED_SENT', 'ACKNOWLEDGED'] } },
        orderBy: { sentAt: 'desc' },
        include: { outcome: true },
    });
    res.json(interventions);
}));

/** PATCH /api/interventions/:id/approve — HOD approves, wired to interventionService */
router.patch('/:id/approve', requireRole(['HOD']), asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const { finalPlan } = req.body as { finalPlan?: string };
    await approveIntervention(id, finalPlan);
    res.json({ message: 'Intervention approved and sent.' });
}));

/** PATCH /api/interventions/:id/dismiss — HOD or EDUCATOR */
router.patch('/:id/dismiss', requireRole(['HOD', 'EDUCATOR']), asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    const updated = await prisma.intervention.update({
        where: { id },
        data: { status: 'DISMISSED' },
    });
    res.json(updated);
}));

/** PATCH /api/interventions/:id/complete — STUDENT acknowledges */
router.patch('/:id/complete', asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = String(req.params.id);
    const { feedback } = req.body as { feedback?: string };
    const studentId = req.userId!;

    const intervention = await prisma.intervention.findFirst({ where: { id, studentId } });
    if (!intervention) throw new ApiError(404, 'Intervention not found.', 'NOT_FOUND');

    const updated = await prisma.intervention.update({
        where: { id },
        data: { status: 'COMPLETED', seenAt: new Date() },
    });

    if (feedback) {
        await prisma.interventionOutcome.upsert({
            where: { interventionId: id },
            update: { studentFeedback: feedback },
            create: { interventionId: id, studentFeedback: feedback },
        });
    }

    res.json(updated);
}));

/** GET /api/interventions/effectiveness — HOD + ADMIN outcome analytics */
router.get('/effectiveness', requireRole(['HOD', 'ADMIN']), asyncHandler(async (_req, res) => {
    const outcomes = await prisma.interventionOutcome.findMany({
        include: { intervention: { select: { studentId: true, educatorId: true, status: true } } },
    });
    const improved = outcomes.filter(o => (o.deltaScore ?? 0) < 0).length;
    res.json({ total: outcomes.length, improved, pending: outcomes.filter(o => !o.resolvedAt).length, outcomes });
}));

/** POST /api/interventions/follow-ups — CRON job (protected by CRON_SECRET header) */
router.post('/follow-ups', asyncHandler(async (req, res) => {
    const secret = req.headers['x-cron-secret'];
    if (secret !== process.env.CRON_SECRET) {
        throw new ApiError(401, 'Invalid cron secret.', 'UNAUTHORIZED');
    }
    const result = await process7DayFollowUps();
    res.json(result);
}));

export default router;

/**
 * routes/hod.ts — HoD portal endpoints.
 */
import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roleGuard';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import { prisma } from '../prisma/client';
import { generateNAACPDF } from '../services/naacReportService';

const router = Router();
router.use(authenticateToken);
router.use(requireRole(['HOD', 'ADMIN']));

/** GET /api/hod/department — all students' risk summary */
router.get('/department', asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.userId!;
    const hod = await prisma.user.findUnique({ where: { id: userId }, select: { departmentId: true } });
    const departmentId = hod?.departmentId;

    const students = await prisma.user.findMany({
        where: { departmentId: departmentId ?? undefined, role: 'STUDENT' },
        select: {
            id: true, email: true, rollNumber: true, yearOfStudy: true, section: true,
            riskScores: { orderBy: { calculatedAt: 'desc' }, take: 1, select: { score: true, level: true, calculatedAt: true } },
        },
    });

    const summary = {
        total: students.length,
        red: students.filter(s => s.riskScores[0]?.level === 'RED').length,
        amber: students.filter(s => s.riskScores[0]?.level === 'AMBER').length,
        green: students.filter(s => s.riskScores[0]?.level === 'GREEN').length,
        students,
    };
    res.json(summary);
}));

/** GET /api/hod/heatmap — subject x failure rate matrix */
router.get('/heatmap', asyncHandler(async (_req, res) => {
    const marks = await prisma.examMark.findMany({
        include: { subject: { select: { name: true } } },
    });
    // Group by subject
    const subjectMap: Record<string, { name: string; total: number; below40: number; below50: number; totalMarks: number }> = {};
    for (const m of marks) {
        if (!subjectMap[m.subjectId]) {
            subjectMap[m.subjectId] = { name: m.subject.name, total: 0, below40: 0, below50: 0, totalMarks: 0 };
        }
        const e = subjectMap[m.subjectId];
        e.total++;
        e.totalMarks += m.marks;
        if (m.marks < 40) e.below40++;
        if (m.marks < 50) e.below50++;
    }
    res.json(Object.entries(subjectMap).map(([id, v]) => ({
        subjectId: id, ...v,
        avgMarks: v.total ? Math.round(v.totalMarks / v.total) : 0,
    })));
}));

/** GET /api/hod/educators — educator intervention activity */
router.get('/educators', asyncHandler(async (_req, res) => {
    const educators = await prisma.user.findMany({
        where: { role: 'EDUCATOR' },
        select: {
            id: true, email: true,
            interventionsSent: { select: { id: true, status: true, createdAt: true, sentAt: true } },
        },
    });
    res.json(educators.map(e => ({
        id: e.id, email: e.email,
        interventionsCreated: e.interventionsSent.length,
        pendingReview: e.interventionsSent.filter(i => i.status === 'PENDING_REVIEW').length,
    })));
}));

/** PATCH /api/hod/thresholds — set department thresholds */
router.patch('/thresholds', asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.userId!;
    const hod = await prisma.user.findUnique({ where: { id: userId }, select: { departmentId: true } });
    const { attendanceMin, marksMin, neglectDays, lmsLoginsMin } = req.body;

    const config = await prisma.riskThresholdConfig.upsert({
        where: { departmentId: hod?.departmentId ?? undefined },
        update: { attendanceMin, marksMin, neglectDays, lmsLoginsMin },
        create: { departmentId: hod?.departmentId, attendanceMin, marksMin, neglectDays, lmsLoginsMin },
    });
    res.json(config);
}));

/** GET /api/hod/interventions/pending — RED cases needing HoD approval */
router.get('/interventions/pending', asyncHandler(async (_req, res) => {
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

/** PATCH /api/hod/interventions/:id/approve */
router.patch('/interventions/:id/approve', asyncHandler(async (req, res) => {
    const interventionId = String(req.params.id);
    const { finalPlan } = req.body as { finalPlan?: string };
    const updated = await prisma.intervention.update({
        where: { id: interventionId },
        data: { status: finalPlan ? 'MODIFIED_SENT' : 'APPROVED', finalPlan: finalPlan ?? undefined, sentAt: new Date() },
    });
    res.json(updated);
}));

/** POST /api/hod/reports/naac — NAAC PDF generation */
router.post('/reports/naac', asyncHandler(async (_req, res) => {
    const buffer = await generateNAACPDF();
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="learnsphere-naac-${date}.pdf"`);
    res.send(buffer);
}));

export default router;

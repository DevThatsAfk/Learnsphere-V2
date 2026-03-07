/**
 * routes/advisor.ts — Advisor portal endpoints.
 */
import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roleGuard';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import { prisma } from '../prisma/client';

const router = Router();
router.use(authenticateToken);
router.use(requireRole(['ADVISOR']));

/** GET /api/advisor/students — assigned students sorted by risk */
router.get('/students', asyncHandler(async (req: AuthenticatedRequest, res) => {
    const advisorId = req.userId!;
    const assignments = await prisma.advisorAssignment.findMany({
        where: { advisorId },
        include: {
            student: {
                select: {
                    id: true, email: true, rollNumber: true, yearOfStudy: true, section: true,
                    riskScores: { orderBy: { calculatedAt: 'desc' }, take: 1, select: { score: true, level: true, calculatedAt: true } },
                }
            }
        },
    });
    // Sort RED first
    const students = assignments.map(a => a.student).sort((a, b) => {
        const lvlOrder = { RED: 0, AMBER: 1, GREEN: 2 };
        const la = (a.riskScores[0]?.level ?? 'GREEN') as 'RED' | 'AMBER' | 'GREEN';
        const lb = (b.riskScores[0]?.level ?? 'GREEN') as 'RED' | 'AMBER' | 'GREEN';
        return lvlOrder[la] - lvlOrder[lb];
    });
    res.json(students);
}));

/** GET /api/advisor/students/:id */
router.get('/students/:id', asyncHandler(async (req: AuthenticatedRequest, res) => {
    const advisorId = req.userId!;
    const studentId = String(req.params.id);

    const assignment = await prisma.advisorAssignment.findFirst({ where: { advisorId, studentId } });
    if (!assignment) throw new ApiError(403, 'Student not assigned to you.', 'FORBIDDEN');

    const [riskScores, interventions, notes] = await Promise.all([
        prisma.riskScore.findMany({ where: { userId: studentId }, orderBy: { calculatedAt: 'desc' }, take: 10, include: { flags: true } }),
        prisma.intervention.findMany({ where: { studentId }, orderBy: { createdAt: 'desc' }, include: { outcome: true } }),
        prisma.counsellingNote.findMany({ where: { studentId, advisorId }, orderBy: { sessionAt: 'desc' } }),
    ]);

    res.json({ studentId, riskScores, interventions, notes });
}));

/** POST /api/advisor/notes */
router.post('/notes', asyncHandler(async (req: AuthenticatedRequest, res) => {
    const advisorId = req.userId!;
    const { studentId, note, sessionAt } = req.body as { studentId: string; note: string; sessionAt: string };
    if (!note?.trim()) throw new ApiError(400, 'note is required.', 'MISSING_NOTE');

    const record = await prisma.counsellingNote.create({
        data: { advisorId, studentId, note: note.trim(), sessionAt: new Date(sessionAt ?? Date.now()) },
    });
    res.status(201).json(record);
}));

/** GET /api/advisor/notes/:studentId */
router.get('/notes/:studentId', asyncHandler(async (req: AuthenticatedRequest, res) => {
    const advisorId = req.userId!;
    const { studentId: rawStudentId } = req.params;
    const studentId = String(rawStudentId);
    const notes = await prisma.counsellingNote.findMany({
        where: { advisorId, studentId },
        orderBy: { sessionAt: 'desc' },
    });
    res.json(notes);
}));

/** GET /api/advisor/interventions */
router.get('/interventions', asyncHandler(async (req: AuthenticatedRequest, res) => {
    const advisorId = req.userId!;
    // Advisors can see interventions for their assigned students
    const assigned = await prisma.advisorAssignment.findMany({ where: { advisorId }, select: { studentId: true } });
    const studentIds = assigned.map(a => a.studentId);
    const interventions = await prisma.intervention.findMany({
        where: { studentId: { in: studentIds } },
        orderBy: { createdAt: 'desc' },
        include: { outcome: true, student: { select: { id: true, email: true } } },
    });
    res.json(interventions);
}));

export default router;

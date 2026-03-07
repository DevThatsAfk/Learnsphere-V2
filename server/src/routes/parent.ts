/**
 * routes/parent.ts — Parent portal endpoints.
 */
import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roleGuard';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import { prisma } from '../prisma/client';

const router = Router();
router.use(authenticateToken);
router.use(requireRole(['PARENT']));

/** GET /api/parent/children */
router.get('/children', asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parentId = req.userId!;
    const links = await prisma.parentStudentLink.findMany({
        where: { parentId },
        include: {
            student: {
                select: {
                    id: true, email: true, rollNumber: true, yearOfStudy: true, section: true,
                    riskScores: { orderBy: { calculatedAt: 'desc' }, take: 1 },
                }
            }
        },
    });
    res.json(links.map(l => l.student));
}));

/** GET /api/parent/children/:id/summary */
router.get('/children/:id/summary', asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parentId = req.userId!;
    const studentId = String(req.params.id);

    // Verify parent has access to this child
    const link = await prisma.parentStudentLink.findFirst({ where: { parentId, studentId } });
    if (!link) throw new ApiError(403, 'You are not linked to this student.', 'FORBIDDEN');

    const [riskScore, attendance, riskFlags] = await Promise.all([
        prisma.riskScore.findFirst({ where: { userId: studentId }, orderBy: { calculatedAt: 'desc' }, include: { flags: true } }),
        prisma.attendanceRecord.findMany({ where: { userId: studentId }, orderBy: { date: 'desc' }, take: 30 }),
        prisma.riskFlag.findMany({ where: { userId: studentId, resolvedAt: null } }),
    ]);

    res.json({ studentId, riskScore, attendance, activeFlags: riskFlags });
}));

/** GET /api/parent/alerts */
router.get('/alerts', asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parentId = req.userId!;
    const children = await prisma.parentStudentLink.findMany({ where: { parentId }, select: { studentId: true } });
    const studentIds = children.map(c => c.studentId);

    const alerts = await prisma.riskScore.findMany({
        where: { userId: { in: studentIds }, level: { in: ['RED', 'AMBER'] } },
        orderBy: { calculatedAt: 'desc' },
        include: { user: { select: { id: true, email: true } }, flags: { where: { resolvedAt: null } } },
    });
    res.json(alerts);
}));

/** POST /api/parent/chat */
router.post('/chat', asyncHandler(async (req: AuthenticatedRequest, res) => {
    const fromId = req.userId!;
    const { toId, studentId, message } = req.body as { toId: string; studentId: string; message: string };
    if (!message?.trim()) throw new ApiError(400, 'message is required.', 'MISSING_MESSAGE');

    const msg = await prisma.chatMessage.create({
        data: { fromId, toId, studentId, message: message.trim() },
    });
    res.status(201).json(msg);
}));

/** GET /api/parent/chat/:studentId */
router.get('/chat/:studentId', asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parentId = req.userId!;
    const studentId = String(req.params.studentId);
    const messages = await prisma.chatMessage.findMany({
        where: { studentId, OR: [{ fromId: parentId }, { toId: parentId }] },
        orderBy: { createdAt: 'asc' },
        take: 50,
    });
    res.json(messages);
}));

export default router;

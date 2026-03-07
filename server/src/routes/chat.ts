/**
 * routes/chat.ts — REST fallback for chat history (WebSocket is primary).
 */
import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import { prisma } from '../prisma/client';

const router = Router();
router.use(authenticateToken);

/** GET /api/chat/:studentId — chat thread (REST fallback) */
router.get('/:studentId', asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = String(req.params.studentId);
    const userId = req.userId!;

    const messages = await prisma.chatMessage.findMany({
        where: { studentId, OR: [{ fromId: userId }, { toId: userId }] },
        orderBy: { createdAt: 'asc' },
        take: 50,
        include: { from: { select: { id: true, email: true } } },
    });
    res.json(messages);
}));

/** PATCH /api/chat/read — mark messages as read */
router.patch('/read', asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { messageIds } = req.body as { messageIds: string[] };
    const toId = req.userId!;

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
        throw new ApiError(400, 'messageIds array required.', 'MISSING_FIELDS');
    }

    await prisma.chatMessage.updateMany({
        where: { id: { in: messageIds }, toId },
        data: { readAt: new Date() },
    });
    res.json({ marked: messageIds.length });
}));

export default router;

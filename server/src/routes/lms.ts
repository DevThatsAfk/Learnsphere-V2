/**
 * routes/lms.ts — LMS + Attendance import/sync endpoints.
 * Phase 4 wires lmsService.ts for real CSV parsing and Moodle sync.
 */
import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/roleGuard';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import { upload } from '../middleware/upload';
import { prisma } from '../prisma/client';
import { importAttendanceCSV, importActivityCSV } from '../services/lmsService';

const router = Router();
router.use(authenticateToken);

/** POST /api/lms/import/attendance — CSV upload */
router.post('/import/attendance', requireRole(['ADMIN', 'EDUCATOR']),
    upload.single('file'),
    asyncHandler(async (req, res) => {
        if (!req.file) throw new ApiError(400, 'CSV file required.', 'MISSING_FILE');
        const batchId = `ATT-${Date.now()}`;
        const result = await importAttendanceCSV(req.file.buffer, batchId);
        res.json({ batchId, ...result });
    })
);

/** POST /api/lms/import/activity — LMS activity CSV */
router.post('/import/activity', requireRole(['ADMIN', 'EDUCATOR']),
    upload.single('file'),
    asyncHandler(async (req, res) => {
        if (!req.file) throw new ApiError(400, 'CSV file required.', 'MISSING_FILE');
        const batchId = `ACT-${Date.now()}`;
        const result = await importActivityCSV(req.file.buffer, batchId);
        res.json({ batchId, ...result });
    })
);

/** POST /api/lms/sync/moodle — Moodle sync */
router.post('/sync/moodle', requireRole(['ADMIN']), asyncHandler(async (_req, res) => {
    res.json({ message: 'Moodle sync stub. Implementation in Phase 4.' });
}));

/** POST /api/lms/sync/classroom — Google Classroom sync */
router.post('/sync/classroom', requireRole(['ADMIN']), asyncHandler(async (_req, res) => {
    res.json({ message: 'Google Classroom sync stub. Implementation in Phase 4.' });
}));

/** POST /api/lms/attendance — manual single record */
router.post('/attendance', requireRole(['EDUCATOR']), asyncHandler(async (req, res) => {
    const { userId, subjectId, date, status } = req.body as {
        userId: string; subjectId: string; date: string; status: string;
    };
    if (!userId || !subjectId || !date || !status) {
        throw new ApiError(400, 'userId, subjectId, date, and status are required.', 'MISSING_FIELDS');
    }
    const record = await prisma.attendanceRecord.upsert({
        where: { userId_subjectId_date: { userId, subjectId, date: new Date(date) } },
        update: { status: status as 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' },
        create: { userId, subjectId, date: new Date(date), status: status as 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' },
    });
    res.status(201).json(record);
}));

/** GET /api/lms/attendance/:userId — attendance summary */
router.get('/attendance/:userId', requireRole(['EDUCATOR', 'HOD', 'PARENT']), asyncHandler(async (req, res) => {
    const userId = String(req.params.userId);
    const records = await prisma.attendanceRecord.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
        take: 90, // last 90 days of records
    });
    res.json(records);
}));

/** POST /api/competitions */
router.post('/competitions', asyncHandler(async (req, res) => {
    const { userId, name, category, result, participatedAt } = req.body;
    const entry = await prisma.competitionEntry.create({
        data: { userId, name, category, result, participatedAt: new Date(participatedAt) },
    });
    res.status(201).json(entry);
}));

/** GET /api/competitions/:userId */
router.get('/competitions/:userId', asyncHandler(async (req, res) => {
    const userId = String(req.params.userId);
    const entries = await prisma.competitionEntry.findMany({
        where: { userId },
        orderBy: { participatedAt: 'desc' },
    });
    res.json(entries);
}));

export default router;

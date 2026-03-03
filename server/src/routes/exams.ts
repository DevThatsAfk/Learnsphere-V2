import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import {
    getExams,
    createExam,
    getMarksForExam,
    addMarksForExam,
} from '../services/examService';

const router = Router();
router.use(authenticateToken);

/**
 * GET /api/exams
 * Returns all exams ordered by exam_date ascending.
 * Response: Exam[] — { id, title, exam_date }
 */
router.get(
    '/',
    asyncHandler(async (req: AuthenticatedRequest, res) => {
        const userId = req.userId!;
        const exams = await getExams(userId);
        res.json(exams);
    })
);

/**
 * POST /api/exams
 * Body: { title: string, exam_date: string (YYYY-MM-DD) }
 * Response: 201 + Exam — { id, title, exam_date }
 */
router.post(
    '/',
    asyncHandler(async (req: AuthenticatedRequest, res) => {
        const userId = req.userId!;
        const { title, exam_date } = req.body as { title: string; exam_date: string };
        if (!exam_date) throw new ApiError(400, 'exam_date is required.', 'MISSING_DATE');
        const exam = await createExam({ title, examDate: exam_date, userId });
        res.status(201).json(exam);
    })
);

/**
 * GET /api/exams/:examId/marks
 * Returns all marks for this exam that belong to the authenticated user's subjects.
 * Response: ExamMark[] — { subject_id, marks }
 */
router.get(
    '/:examId/marks',
    asyncHandler(async (req: AuthenticatedRequest, res) => {
        const userId = req.userId!;
        const examId = req.params['examId'] as string;
        const marks = await getMarksForExam(examId, userId);
        res.json(marks);
    })
);

/**
 * POST /api/exams/:examId/marks
 * Body: ExamMark[] — [{ subject_id, marks }, ...]
 * Upserts marks (idempotent — re-submission updates the stored mark).
 * Response: 201 Stored
 */
router.post(
    '/:examId/marks',
    asyncHandler(async (req: AuthenticatedRequest, res) => {
        const userId = req.userId!;
        const examId = req.params['examId'] as string;
        const markInputs = req.body as Array<{ subject_id: string; marks: number }>;
        if (!Array.isArray(markInputs)) {
            throw new ApiError(400, 'Request body must be an array of marks.', 'INVALID_BODY');
        }
        await addMarksForExam(examId, markInputs, userId);
        res.status(201).json({ stored: true });
    })
);

export default router;

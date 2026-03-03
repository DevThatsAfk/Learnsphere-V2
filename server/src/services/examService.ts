import { prisma } from '../prisma/client';
import { ApiError } from '../middleware/errorHandler';

interface CreateExamInput {
    title: string;
    examDate: string; // YYYY-MM-DD from client
}

interface ExamMarkInput {
    subject_id: string;
    marks: number;
}

// ─────────────────────────────────────────────────
// EXAM CRUD
// ─────────────────────────────────────────────────

/**
 * Get all exams (global — not user-scoped per DATABASE_SCHEMA.md / API_CONTRACTS.md).
 * Ordered by exam_date ascending (upcoming first).
 */
export async function getExams() {
    const exams = await prisma.exam.findMany({
        orderBy: { examDate: 'asc' },
        select: { id: true, title: true, examDate: true },
    });

    return exams.map((e: { id: string; title: string; examDate: Date }) => ({
        id: e.id,
        title: e.title,
        exam_date: e.examDate.toISOString().split('T')[0], // YYYY-MM-DD per API contract
    }));
}

/**
 * Create an exam.
 * exam_date must be a valid date string (YYYY-MM-DD).
 */
export async function createExam(input: CreateExamInput) {
    const { title, examDate } = input;

    if (!title || title.trim().length === 0) {
        throw new ApiError(400, 'Exam title is required.', 'INVALID_TITLE');
    }

    const parsedDate = new Date(examDate);
    if (isNaN(parsedDate.getTime())) {
        throw new ApiError(400, 'exam_date must be a valid date (YYYY-MM-DD).', 'INVALID_DATE');
    }

    const exam = await prisma.exam.create({
        data: {
            title: title.trim(),
            examDate: parsedDate,
        },
        select: { id: true, title: true, examDate: true },
    });

    return {
        id: exam.id,
        title: exam.title,
        exam_date: exam.examDate.toISOString().split('T')[0],
    };
}

// ─────────────────────────────────────────────────
// MARKS CRUD
// ─────────────────────────────────────────────────

/**
 * Get all marks for an exam.
 * Returns only marks for subjects that belong to the authenticated user.
 */
export async function getMarksForExam(examId: string, userId: string) {
    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) {
        throw new ApiError(404, 'Exam not found.', 'NOT_FOUND');
    }

    const marks = await prisma.examMark.findMany({
        where: {
            examId,
            subject: { userId }, // only marks scoped to this user's subjects
        },
        select: { subjectId: true, marks: true },
    });

    return marks.map((m: { subjectId: string; marks: number }) => ({
        subject_id: m.subjectId,
        marks: m.marks,
    }));
}

/**
 * Add (or update) marks for an exam — batch upsert.
 * Body is an array of { subject_id, marks }.
 * Each subject_id must belong to the authenticated user.
 * Marks must be 0–100 (integer).
 *
 * Uses upsert because @@unique([examId, subjectId]) prevents duplicate rows —
 * retaking an exam just updates the stored mark.
 */
export async function addMarksForExam(
    examId: string,
    markInputs: ExamMarkInput[],
    userId: string
) {
    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) {
        throw new ApiError(404, 'Exam not found.', 'NOT_FOUND');
    }

    if (!Array.isArray(markInputs) || markInputs.length === 0) {
        throw new ApiError(400, 'Marks array must not be empty.', 'EMPTY_MARKS');
    }

    // Validate all marks before writing anything (fail-fast)
    for (const item of markInputs) {
        if (!item.subject_id) {
            throw new ApiError(400, 'Each entry must have a subject_id.', 'MISSING_SUBJECT_ID');
        }
        if (typeof item.marks !== 'number' || !Number.isInteger(item.marks)) {
            throw new ApiError(400, 'marks must be an integer.', 'INVALID_MARKS');
        }
        if (item.marks < 0 || item.marks > 100) {
            throw new ApiError(400, 'marks must be between 0 and 100.', 'MARKS_OUT_OF_RANGE');
        }
    }

    // Verify all subject_ids belong to this user
    const subjectIds = markInputs.map((m) => m.subject_id);
    const ownedSubjects = await prisma.subject.findMany({
        where: { id: { in: subjectIds }, userId },
        select: { id: true },
    });
    const ownedIds = new Set(ownedSubjects.map((s: { id: string }) => s.id));

    for (const id of subjectIds) {
        if (!ownedIds.has(id)) {
            throw new ApiError(404, `Subject ${id} not found or does not belong to you.`, 'SUBJECT_NOT_FOUND');
        }
    }

    // Upsert all marks in a transaction
    await prisma.$transaction(
        markInputs.map((item) =>
            prisma.examMark.upsert({
                where: { examId_subjectId: { examId, subjectId: item.subject_id } },
                create: { examId, subjectId: item.subject_id, marks: item.marks },
                update: { marks: item.marks },
            })
        )
    );
}

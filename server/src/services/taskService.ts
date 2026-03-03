import { TaskStatus } from '@prisma/client';
import { prisma } from '../prisma/client';
import { ApiError } from '../middleware/errorHandler';

interface CreateTaskInput {
    subjectId: string;
    title: string;
    userId: string;
}

interface CreateChecklistItemInput {
    taskId: string;
    label: string;
    userId: string;
}

interface UpdateChecklistItemInput {
    itemId: string;
    taskId: string;
    isCompleted: boolean;
    userId: string;
}

// ─────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────

/**
 * Verifies the task belongs to the authenticated user (via subject ownership).
 */
async function assertTaskOwnership(taskId: string, userId: string) {
    const task = await prisma.task.findFirst({
        where: { id: taskId, subject: { userId } },
    });
    if (!task) {
        throw new ApiError(404, 'Task not found.', 'NOT_FOUND');
    }
    return task;
}

/**
 * After any checklist change, recomputes and saves:
 * - completion_percentage (completed items / total items * 100)
 * - status (NOT_STARTED / IN_PROGRESS / COMPLETED)
 *
 * This is deterministic backend logic — no frontend computation allowed.
 */
async function syncTaskCompletion(taskId: string) {
    const items = await prisma.taskChecklist.findMany({ where: { taskId } });

    if (items.length === 0) {
        // No checklist items — keep status without override
        return;
    }

    const completed = items.filter((i) => i.isCompleted).length;
    const total = items.length;
    const completionPercentage = Math.round((completed / total) * 100);

    let status: TaskStatus;
    if (completed === 0) {
        status = TaskStatus.NOT_STARTED;
    } else if (completed === total) {
        status = TaskStatus.COMPLETED;
    } else {
        status = TaskStatus.IN_PROGRESS;
    }

    await prisma.task.update({
        where: { id: taskId },
        data: { completionPercentage, status },
    });
}

// ─────────────────────────────────────────────────
// TASK CRUD
// ─────────────────────────────────────────────────

export async function getTasksForUser(userId: string) {
    const tasks = await prisma.task.findMany({
        where: { subject: { userId } },
        orderBy: { createdAt: 'asc' },
        select: {
            id: true,
            title: true,
            subjectId: true,
            status: true,
            completionPercentage: true,
        },
    });

    // Map to API contract shape
    return tasks.map((t) => ({
        id: t.id,
        title: t.title,
        subject_id: t.subjectId,
        status: t.status,
        completion_percentage: t.completionPercentage,
    }));
}

export async function createTask(input: CreateTaskInput) {
    const { subjectId, title, userId } = input;

    if (!title || title.trim().length === 0) {
        throw new ApiError(400, 'Task title is required.', 'INVALID_TITLE');
    }

    // Verify subject belongs to user
    const subject = await prisma.subject.findFirst({ where: { id: subjectId, userId } });
    if (!subject) {
        throw new ApiError(404, 'Subject not found.', 'NOT_FOUND');
    }

    const task = await prisma.task.create({
        data: { title: title.trim(), subjectId },
        select: {
            id: true,
            title: true,
            subjectId: true,
            status: true,
            completionPercentage: true,
        },
    });

    return {
        id: task.id,
        title: task.title,
        subject_id: task.subjectId,
        status: task.status,
        completion_percentage: task.completionPercentage,
    };
}

export async function deleteTask(taskId: string, userId: string) {
    await assertTaskOwnership(taskId, userId);
    await prisma.task.delete({ where: { id: taskId } });
}

// ─────────────────────────────────────────────────
// CHECKLIST CRUD
// ─────────────────────────────────────────────────

export async function getChecklistForTask(taskId: string, userId: string) {
    await assertTaskOwnership(taskId, userId);

    const items = await prisma.taskChecklist.findMany({
        where: { taskId },
        orderBy: { id: 'asc' },
        select: { id: true, label: true, isCompleted: true },
    });

    return items.map((i) => ({
        id: i.id,
        label: i.label,
        is_completed: i.isCompleted,
    }));
}

export async function addChecklistItem(input: CreateChecklistItemInput) {
    const { taskId, label, userId } = input;

    if (!label || label.trim().length === 0) {
        throw new ApiError(400, 'Checklist item label is required.', 'INVALID_LABEL');
    }

    await assertTaskOwnership(taskId, userId);

    const item = await prisma.taskChecklist.create({
        data: { taskId, label: label.trim() },
        select: { id: true, label: true, isCompleted: true },
    });

    return {
        id: item.id,
        label: item.label,
        is_completed: item.isCompleted,
    };
}

export async function updateChecklistItem(input: UpdateChecklistItemInput) {
    const { itemId, taskId, isCompleted, userId } = input;

    await assertTaskOwnership(taskId, userId);

    const item = await prisma.taskChecklist.findFirst({ where: { id: itemId, taskId } });
    if (!item) {
        throw new ApiError(404, 'Checklist item not found.', 'NOT_FOUND');
    }

    const updated = await prisma.taskChecklist.update({
        where: { id: itemId },
        data: { isCompleted },
        select: { id: true, label: true, isCompleted: true },
    });

    // Sync task completion_percentage and status after every checklist change
    await syncTaskCompletion(taskId);

    return {
        id: updated.id,
        label: updated.label,
        is_completed: updated.isCompleted,
    };
}

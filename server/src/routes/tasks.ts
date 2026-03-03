import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import {
    getTasksForUser,
    createTask,
    deleteTask,
    getChecklistForTask,
    addChecklistItem,
    updateChecklistItem,
} from '../services/taskService';

const router = Router();
router.use(authenticateToken);

/**
 * GET /api/tasks
 * Returns all tasks for the authenticated user across all subjects.
 * Response: Task[]  — { id, title, subject_id, status, completion_percentage }
 */
router.get(
    '/',
    asyncHandler(async (req: AuthenticatedRequest, res) => {
        const userId = req.userId!;
        const tasks = await getTasksForUser(userId);
        res.json(tasks);
    })
);

/**
 * POST /api/tasks
 * Body: { subject_id: string, title: string }
 * Response: 201 + Task
 * NOTE: Endpoint extends API_CONTRACTS.md — required by ATOMIC_TODO and USER_JOURNEY.
 */
router.post(
    '/',
    asyncHandler(async (req: AuthenticatedRequest, res) => {
        const userId = req.userId!;
        const { subject_id, title } = req.body as { subject_id: string; title: string };
        if (!subject_id) throw new ApiError(400, 'subject_id is required.', 'MISSING_SUBJECT_ID');
        const task = await createTask({ subjectId: subject_id, title, userId });
        res.status(201).json(task);
    })
);

/**
 * DELETE /api/tasks/:taskId
 * Response: 204 No Content
 */
router.delete(
    '/:taskId',
    asyncHandler(async (req: AuthenticatedRequest, res) => {
        const userId = req.userId!;
        const taskId = req.params['taskId'] as string;
        await deleteTask(taskId, userId);
        res.status(204).send();
    })
);

/**
 * GET /api/tasks/:taskId/checklist
 * Response: ChecklistItem[] — { id, label, is_completed }
 */
router.get(
    '/:taskId/checklist',
    asyncHandler(async (req: AuthenticatedRequest, res) => {
        const userId = req.userId!;
        const taskId = req.params['taskId'] as string;
        const items = await getChecklistForTask(taskId, userId);
        res.json(items);
    })
);

/**
 * POST /api/tasks/:taskId/checklist
 * Body: { label: string }
 * Response: 201 + ChecklistItem
 * NOTE: Endpoint extends API_CONTRACTS.md — required by USER_JOURNEY Step 2.
 */
router.post(
    '/:taskId/checklist',
    asyncHandler(async (req: AuthenticatedRequest, res) => {
        const userId = req.userId!;
        const taskId = req.params['taskId'] as string;
        const { label } = req.body as { label: string };
        const item = await addChecklistItem({ taskId, label, userId });
        res.status(201).json(item);
    })
);

/**
 * PATCH /api/tasks/:taskId/checklist/:itemId
 * Body: { is_completed: boolean }
 * Response: 200 + ChecklistItem (updated)
 * Also triggers syncTaskCompletion() to update task status & percentage.
 */
router.patch(
    '/:taskId/checklist/:itemId',
    asyncHandler(async (req: AuthenticatedRequest, res) => {
        const userId = req.userId!;
        const taskId = req.params['taskId'] as string;
        const itemId = req.params['itemId'] as string;
        const { is_completed } = req.body as { is_completed: boolean };
        if (typeof is_completed !== 'boolean') {
            throw new ApiError(400, 'is_completed must be a boolean.', 'INVALID_TYPE');
        }
        const item = await updateChecklistItem({ itemId, taskId, isCompleted: is_completed, userId });
        res.json(item);
    })
);

export default router;

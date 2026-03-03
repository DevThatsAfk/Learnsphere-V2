import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { register, login } from '../services/authService';

const router = Router();

/**
 * POST /api/auth/register
 * Body: { email: string, password: string }
 * Response: { token: string }
 */
router.post(
    '/register',
    asyncHandler(async (req, res) => {
        const { email, password } = req.body as { email: string; password: string };
        const result = await register({ email, password });
        res.status(201).json(result);
    })
);

/**
 * POST /api/auth/login
 * Body: { email: string, password: string }
 * Response: { token: string }
 */
router.post(
    '/login',
    asyncHandler(async (req, res) => {
        const { email, password } = req.body as { email: string; password: string };
        const result = await login({ email, password });
        res.status(200).json(result);
    })
);

export default router;

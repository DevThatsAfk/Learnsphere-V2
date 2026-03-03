/**
 * aiRateLimit.ts — Per-user rate limiter for AI endpoints.
 *
 * Applied INSIDE each AI router (after authenticateToken) so that
 * req.userId is already set and we get true per-user limiting.
 *
 * Bug 2 fix: previously applied in index.ts BEFORE auth ran,
 * making req.userId always undefined and degrading to IP-based limits.
 */
import rateLimit from 'express-rate-limit';
import type { AuthenticatedRequest } from './auth';

export const aiRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many AI requests. Please wait 15 minutes before trying again.', code: 'RATE_LIMITED' },
    keyGenerator: (req) => {
        // After authenticateToken, userId is guaranteed to be set
        return (req as AuthenticatedRequest).userId ?? req.ip ?? 'anonymous';
    },
});

/**
 * roleGuard.ts — Role-based access control middleware.
 *
 * Usage: router.use(requireRole(['HOD', 'ADMIN']))
 * Apply AFTER authenticateToken so req.role is populated.
 */
import type { Response, NextFunction } from 'express';
import type { UserRole } from '@prisma/client';
import { ApiError } from './errorHandler';
import type { AuthenticatedRequest } from './auth';

/**
 * Middleware factory — restrict route to one or more roles.
 * Returns 403 if the authenticated user's role is not in the allowed list.
 */
export function requireRole(allowedRoles: UserRole[]) {
    return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
        const userRole = req.role;

        if (!userRole) {
            return next(new ApiError(401, 'Authentication required.', 'UNAUTHORIZED'));
        }

        if (!allowedRoles.includes(userRole)) {
            return next(
                new ApiError(
                    403,
                    `Access denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${userRole}.`,
                    'FORBIDDEN'
                )
            );
        }

        next();
    };
}

/**
 * auth.ts — JWT authentication middleware.
 *
 * v2 change: JWT payload now includes `role` alongside userId and email.
 * AuthenticatedRequest exposes `req.role` for use in roleGuard middleware.
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApiError } from './errorHandler';
import type { UserRole } from '@prisma/client';

export interface AuthenticatedRequest extends Request {
    userId?: string;
    userEmail?: string;
    role?: UserRole; // v2: role embedded from JWT
}

interface JwtPayload {
    userId: string;
    email: string;
    role: UserRole; // v2: role in token payload
}

export const authenticateToken = (
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction
): void => {
    // Dev bypass — only when ENV flag is explicitly "true"
    const bypassAuth = process.env.DEV_BYPASS_AUTH === 'true';

    if (bypassAuth) {
        // HARD BLOCK in production — fail loudly, not silently
        if (process.env.NODE_ENV === 'production') {
            throw new Error(
                'FATAL: DEV_BYPASS_AUTH cannot be enabled in production. Remove it from .env immediately.'
            );
        }
        console.warn('⚠️  WARNING: Auth bypass is active. Development only.');
        req.userId = 'dev-user-id';
        req.userEmail = 'dev@learnsphere.local';
        req.role = 'STUDENT'; // default bypass role
        next();
        return;
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : null;

    if (!token) {
        return next(new ApiError(401, 'Authorization token required.', 'UNAUTHORIZED'));
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
        return next(new ApiError(500, 'Server configuration error.', 'CONFIG_ERROR'));
    }

    try {
        const decoded = jwt.verify(token, secret) as JwtPayload;
        req.userId = decoded.userId;
        req.userEmail = decoded.email;
        req.role = decoded.role ?? 'STUDENT'; // fallback for v1 tokens without role field
        next();
    } catch {
        return next(new ApiError(401, 'Invalid or expired token.', 'INVALID_TOKEN'));
    }
};

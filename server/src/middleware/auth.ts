import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApiError } from './errorHandler';

export interface AuthenticatedRequest extends Request {
    userId?: string;
    userEmail?: string;
}

interface JwtPayload {
    userId: string;
    email: string;
}

export const authenticateToken = (
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction
): void => {
    // Dev bypass — only when ENV flag is explicitly "true"
    const bypassAuth = process.env.DEV_BYPASS_AUTH === 'true';

    if (bypassAuth) {
        // HARD BLOCK in production — fail loudly at startup, not silently at runtime
        if (process.env.NODE_ENV === 'production') {
            throw new Error(
                'FATAL: DEV_BYPASS_AUTH cannot be enabled in production. Remove it from .env immediately.'
            );
        }
        console.warn('⚠️  WARNING: Auth bypass is active. Development only.');
        req.userId = 'dev-user-id';
        req.userEmail = 'dev@learnsphere.local';
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
        next();
    } catch {
        return next(new ApiError(401, 'Invalid or expired token.', 'INVALID_TOKEN'));
    }
};

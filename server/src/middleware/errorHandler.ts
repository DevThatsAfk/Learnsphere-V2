import { Request, Response, NextFunction } from 'express';

// Global error handler interface
export interface AppError extends Error {
    statusCode?: number;
    code?: string;
}

// Standard API error response
export class ApiError extends Error {
    public statusCode: number;
    public code: string;

    constructor(statusCode: number, message: string, code: string = 'ERROR') {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.name = 'ApiError';
    }
}

// Async handler wrapper — prevents try/catch duplication in route handlers
export const asyncHandler = (
    fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

// Global error handler middleware
export const errorHandler = (
    err: AppError,
    req: Request,
    res: Response,
    _next: NextFunction
): void => {
    console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

    if (err instanceof ApiError) {
        res.status(err.statusCode).json({
            error: err.message,
            code: err.code,
        });
        return;
    }

    // Prisma unique constraint violation
    if ((err as { code?: string }).code === 'P2002') {
        res.status(409).json({
            error: 'A record with this data already exists.',
            code: 'CONFLICT',
        });
        return;
    }

    // Prisma record not found
    if ((err as { code?: string }).code === 'P2025') {
        res.status(404).json({
            error: 'Record not found.',
            code: 'NOT_FOUND',
        });
        return;
    }

    // Default 500
    res.status(500).json({
        error: 'Internal server error.',
        code: 'INTERNAL_ERROR',
    });
};

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler';

// Route imports
import authRouter from './routes/auth';
import subjectsRouter from './routes/subjects';
import tasksRouter from './routes/tasks';
import sessionsRouter from './routes/sessions';
import analyticsRouter from './routes/analytics';
import examsRouter from './routes/exams';
import reviewsRouter from './routes/reviews';
import summarizeRouter from './routes/summarize';
import notesRouter from './routes/notes';
import generateRouter from './routes/generate';
import uploadRouter from './routes/upload';

const app = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);

// ─────────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────────
app.use(cors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─────────────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─────────────────────────────────────────────────
// RATE LIMITING — exported and applied INSIDE each AI router
// so it runs AFTER authenticateToken (userId is set by then)
// ─────────────────────────────────────────────────
// (Rate limiter moved to middleware/aiRateLimit.ts)

// ─────────────────────────────────────────────────
// API ROUTES (mounted at /api)
// ─────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/subjects', subjectsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/exams', examsRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/summarize', summarizeRouter);
app.use('/api/notes', notesRouter);
app.use('/api/generate', generateRouter);
app.use('/api/upload', uploadRouter);

// ─────────────────────────────────────────────────
// GLOBAL ERROR HANDLER (must be last)
// ─────────────────────────────────────────────────
app.use(errorHandler);

// ─────────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`[LearnSphere API] Server running on http://localhost:${PORT}`);
    console.log(`[LearnSphere API] Health: http://localhost:${PORT}/health`);
    console.log(`[LearnSphere API] Environment: ${process.env.NODE_ENV ?? 'development'}`);
});

export default app;

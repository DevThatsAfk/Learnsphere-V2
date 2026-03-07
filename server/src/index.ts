import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import { Server as SocketServer } from 'socket.io';
import { errorHandler } from './middleware/errorHandler';
import { initChatSocket } from './socket/chatSocket';
import { startFollowUpCron } from './cron/followUpCron';

// ─── v1 Route imports ────────────────────────────
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

// ─── v2 Route imports ────────────────────────────
import riskRouter from './routes/risk';
import interventionsRouter from './routes/interventions';
import lmsRouter from './routes/lms';
import parentRouter from './routes/parent';
import advisorRouter from './routes/advisor';
import hodRouter from './routes/hod';
import adminRouter from './routes/admin';
import chatRouter from './routes/chat';

const app = express();
const httpServer = http.createServer(app);
const PORT = parseInt(process.env.PORT ?? '3001', 10);

// ─────────────────────────────────────────────────
// SOCKET.IO — v2 WebSocket for chat
// ─────────────────────────────────────────────────
const io = new SocketServer(httpServer, {
    cors: {
        origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
        credentials: true,
    },
});
initChatSocket(io);

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
// API ROUTES — v1 (unchanged)
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
// API ROUTES — v2 (new institutional layer)
// ─────────────────────────────────────────────────
app.use('/api/risk', riskRouter);
app.use('/api/interventions', interventionsRouter);
app.use('/api/lms', lmsRouter);
app.use('/api/parent', parentRouter);
app.use('/api/advisor', advisorRouter);
app.use('/api/hod', hodRouter);
app.use('/api/admin', adminRouter);
app.use('/api/chat', chatRouter);

// ─────────────────────────────────────────────────
// GLOBAL ERROR HANDLER (must be last)
// ─────────────────────────────────────────────────
app.use(errorHandler);

// ─────────────────────────────────────────────────
// START SERVER (using httpServer for Socket.io)
// ─────────────────────────────────────────────────
httpServer.listen(PORT, () => {
    console.log(`[LearnSphere API] Server running on http://localhost:${PORT}`);
    console.log(`[LearnSphere API] Health: http://localhost:${PORT}/health`);
    console.log(`[LearnSphere API] Environment: ${process.env.NODE_ENV ?? 'development'}`);
    console.log(`[LearnSphere API] v2 routes: risk, interventions, lms, parent, advisor, hod, admin, chat`);
    startFollowUpCron(); // Phase 3: 7-day follow-up cron
});

export default app;

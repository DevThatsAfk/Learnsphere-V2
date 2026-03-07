/**
 * socket/chatSocket.ts — Socket.io WebSocket handler for real-time chat.
 *
 * Room structure: chat:{studentId}
 * Members: parents of student + educators of student subjects + advisors assigned to student
 *
 * Events (client → server): chat:join, chat:message, chat:typing
 * Events (server → client): chat:message, chat:history, chat:typing, chat:read
 */
import type { Server } from 'socket.io';
import { prisma } from '../prisma/client';

export function initChatSocket(io: Server) {
    io.on('connection', (socket) => {
        // Join a student-scoped chat room
        socket.on('chat:join', async ({ studentId, userId }: { studentId: string; userId: string }) => {
            const room = `chat:${studentId}`;
            socket.join(room);

            // Send last 50 messages as chat:history
            const messages = await prisma.chatMessage.findMany({
                where: { studentId },
                orderBy: { createdAt: 'asc' },
                take: 50,
                include: { from: { select: { id: true, email: true } } },
            });

            socket.emit('chat:history', { messages });
            console.log(`[Chat] ${userId} joined room ${room}`);
        });

        // Relay a message to all room members + persist
        socket.on('chat:message', async ({
            studentId,
            fromId,
            toId,
            message,
        }: {
            studentId: string;
            fromId: string;
            toId: string;
            message: string;
        }) => {
            if (!message?.trim()) return;

            const saved = await prisma.chatMessage.create({
                data: { fromId, toId, studentId, message: message.trim() },
                include: { from: { select: { id: true, email: true } } },
            });

            io.to(`chat:${studentId}`).emit('chat:message', {
                id: saved.id,
                fromId: saved.fromId,
                fromName: saved.from.email,
                message: saved.message,
                createdAt: saved.createdAt,
            });
        });

        // Broadcast typing indicator
        socket.on('chat:typing', ({ studentId, userId, isTyping }: {
            studentId: string;
            userId: string;
            isTyping: boolean;
        }) => {
            socket.to(`chat:${studentId}`).emit('chat:typing', { userId, isTyping });
        });
    });
}

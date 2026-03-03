/**
 * noteService.ts — CRUD for user study notes.
 *
 * Rules (enforced here):
 *  - Notes are ALWAYS user-owned (userId checked on every write/delete).
 *  - AI never calls this service directly.
 *  - content is plain text (1–20,000 chars, validated in route).
 *  - topic is optional — used to scope notes to a session topic.
 */
import { prisma } from '../prisma/client';

// ─── List notes for a subject (optionally filtered by topic) ───────
export async function getNotesForSubject(
    userId: string,
    subjectId: string,
    topic?: string,
) {
    return prisma.note.findMany({
        where: {
            userId,
            subjectId,
            ...(topic ? { topic } : {}),
        },
        orderBy: { updatedAt: 'desc' },
    });
}

// ─── Create a new note ────────────────────────────────────────────
export async function createNote(data: {
    userId: string;
    subjectId: string;
    topic?: string;
    content: string;
}) {
    // Verify subject belongs to user
    const subject = await prisma.subject.findFirst({
        where: { id: data.subjectId, userId: data.userId },
    });
    if (!subject) throw new Error('Subject not found or access denied.');

    return prisma.note.create({ data });
}

// ─── Update note content ─────────────────────────────────────────
export async function updateNote(
    noteId: string,
    userId: string,
    content: string,
) {
    // Verify ownership before update
    const note = await prisma.note.findFirst({ where: { id: noteId, userId } });
    if (!note) throw new Error('Note not found or access denied.');

    return prisma.note.update({
        where: { id: noteId },
        data: { content },
    });
}

// ─── Delete note ─────────────────────────────────────────────────
export async function deleteNote(noteId: string, userId: string) {
    const note = await prisma.note.findFirst({ where: { id: noteId, userId } });
    if (!note) throw new Error('Note not found or access denied.');

    await prisma.note.delete({ where: { id: noteId } });
}

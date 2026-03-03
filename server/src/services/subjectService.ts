import { prisma } from '../prisma/client';
import { ApiError } from '../middleware/errorHandler';

interface CreateSubjectInput {
    name: string;
    userId: string;
}

export async function getSubjectsForUser(userId: string) {
    return prisma.subject.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true },
    });
}

export async function createSubject(input: CreateSubjectInput) {
    const { name, userId } = input;

    if (!name || name.trim().length === 0) {
        throw new ApiError(400, 'Subject name is required.', 'INVALID_NAME');
    }
    if (name.trim().length > 100) {
        throw new ApiError(400, 'Subject name must be 100 characters or fewer.', 'NAME_TOO_LONG');
    }

    // Prevent duplicate subject names per user
    const existing = await prisma.subject.findFirst({
        where: { userId, name: { equals: name.trim(), mode: 'insensitive' } },
    });
    if (existing) {
        throw new ApiError(409, 'You already have a subject with this name.', 'SUBJECT_EXISTS');
    }

    return prisma.subject.create({
        data: { name: name.trim(), userId },
        select: { id: true, name: true },
    });
}

export async function deleteSubject(subjectId: string, userId: string) {
    const subject = await prisma.subject.findFirst({ where: { id: subjectId, userId } });
    if (!subject) {
        throw new ApiError(404, 'Subject not found.', 'NOT_FOUND');
    }
    await prisma.subject.delete({ where: { id: subjectId } });
}

export async function renameSubject(subjectId: string, name: string, userId: string) {
    if (!name || name.trim().length === 0) {
        throw new ApiError(400, 'Subject name is required.', 'INVALID_NAME');
    }
    if (name.trim().length > 100) {
        throw new ApiError(400, 'Subject name must be 100 characters or fewer.', 'NAME_TOO_LONG');
    }

    // Verify ownership
    const subject = await prisma.subject.findFirst({ where: { id: subjectId, userId } });
    if (!subject) {
        throw new ApiError(404, 'Subject not found.', 'NOT_FOUND');
    }

    // Prevent duplicate names (case-insensitive), excluding this subject itself
    const duplicate = await prisma.subject.findFirst({
        where: {
            userId,
            name: { equals: name.trim(), mode: 'insensitive' },
            NOT: { id: subjectId },
        },
    });
    if (duplicate) {
        throw new ApiError(409, 'You already have a subject with this name.', 'SUBJECT_EXISTS');
    }

    return prisma.subject.update({
        where: { id: subjectId },
        data: { name: name.trim() },
        select: { id: true, name: true },
    });
}

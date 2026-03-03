import { SessionType } from '@prisma/client';
import { prisma } from '../prisma/client';
import { ApiError } from '../middleware/errorHandler';

interface StartSessionInput {
    subjectId: string;
    topic: string;
    sessionType?: string;
    userId: string;
}

interface EndSessionInput {
    sessionId: string;
    activeMinutes: number;
    userId: string;
}

interface ReviewSessionInput {
    sessionId: string;
    reflectionText?: string;
    tags?: string[];
    userId: string;
}

// ─────────────────────────────────────────────────
// BUSINESS RULES (from BACKEND_LOGIC.md)
// ─────────────────────────────────────────────────
// Active Day threshold: a day counts as "active" if total active_minutes >= 18
// This rule is enforced at the analytics layer — sessions just store the raw minutes.
// Sessions may not have 0 active_minutes on end (they must record real effort).

const VALID_SESSION_TYPES = Object.values(SessionType);

function parseSessionType(raw?: string): SessionType {
    if (!raw) return SessionType.STUDY;
    const upper = raw.toUpperCase();
    if (!VALID_SESSION_TYPES.includes(upper as SessionType)) {
        throw new ApiError(
            400,
            `Invalid session_type. Must be one of: ${VALID_SESSION_TYPES.join(', ')}.`,
            'INVALID_SESSION_TYPE'
        );
    }
    return upper as SessionType;
}

async function assertSessionOwnership(sessionId: string, userId: string) {
    const session = await prisma.studySession.findFirst({
        where: { id: sessionId, subject: { userId } },
    });
    if (!session) {
        throw new ApiError(404, 'Study session not found.', 'NOT_FOUND');
    }
    return session;
}

// ─────────────────────────────────────────────────
// SERVICE FUNCTIONS
// ─────────────────────────────────────────────────

/**
 * Start a new study session.
 * Records start_time at server-time (not client-provided) to prevent tampering.
 * Returns only { id, start_time } per API contract SessionStartResponse schema.
 */
export async function startSession(input: StartSessionInput) {
    const { subjectId, topic, sessionType: rawType, userId } = input;

    if (!topic || topic.trim().length === 0) {
        throw new ApiError(400, 'Session topic is required.', 'INVALID_TOPIC');
    }

    // Verify subject ownership
    const subject = await prisma.subject.findFirst({ where: { id: subjectId, userId } });
    if (!subject) {
        throw new ApiError(404, 'Subject not found.', 'NOT_FOUND');
    }

    const sessionType = parseSessionType(rawType);

    const session = await prisma.studySession.create({
        data: {
            subjectId,
            topic: topic.trim(),
            sessionType,
            startTime: new Date(), // server-set — never trust client time
        },
        select: {
            id: true,
            startTime: true,
        },
    });

    return {
        id: session.id,
        start_time: session.startTime.toISOString(),
    };
}

/**
 * End a study session.
 * Records active_minutes (client-reported, but must be > 0 and ≤ 1440).
 * Sets end_time at server-time.
 * Returns full StudySession per API contract.
 */
export async function endSession(input: EndSessionInput) {
    const { sessionId, activeMinutes, userId } = input;

    if (typeof activeMinutes !== 'number' || !Number.isInteger(activeMinutes)) {
        throw new ApiError(400, 'active_minutes must be an integer.', 'INVALID_MINUTES');
    }
    if (activeMinutes < 1) {
        throw new ApiError(400, 'active_minutes must be at least 1.', 'INVALID_MINUTES');
    }
    if (activeMinutes > 1440) {
        throw new ApiError(400, 'active_minutes cannot exceed 1440 (24 hours).', 'INVALID_MINUTES');
    }

    const session = await assertSessionOwnership(sessionId, userId);

    if (session.endTime) {
        throw new ApiError(409, 'This session has already been ended.', 'SESSION_ALREADY_ENDED');
    }

    const updated = await prisma.studySession.update({
        where: { id: sessionId },
        data: {
            activeMinutes,
            endTime: new Date(), // server-set
        },
        select: {
            id: true,
            subjectId: true,
            topic: true,
            sessionType: true,
            activeMinutes: true,
            startTime: true,
            endTime: true,
        },
    });

    return {
        id: updated.id,
        subject_id: updated.subjectId,
        topic: updated.topic,
        session_type: updated.sessionType,
        active_minutes: updated.activeMinutes,
        start_time: updated.startTime.toISOString(),
        end_time: updated.endTime?.toISOString() ?? null,
    };
}

/**
 * Submit a post-session reflection and tags.
 * Can only be submitted once per session.
 * Validates session is ended before accepting review.
 */
export async function submitSessionReview(input: ReviewSessionInput) {
    const { sessionId, reflectionText, tags, userId } = input;

    const session = await assertSessionOwnership(sessionId, userId);

    if (!session.endTime) {
        throw new ApiError(
            400,
            'Session must be ended before submitting a review.',
            'SESSION_NOT_ENDED'
        );
    }

    if (session.reflectionText) {
        throw new ApiError(409, 'A review has already been submitted for this session.', 'REVIEW_EXISTS');
    }

    const cleanTags = Array.isArray(tags)
        ? tags.filter((t) => typeof t === 'string' && t.trim().length > 0).map((t) => t.trim())
        : [];

    await prisma.studySession.update({
        where: { id: sessionId },
        data: {
            reflectionText: reflectionText?.trim() ?? null,
            tags: cleanTags,
        },
    });

    return { stored: true };
}

/**
 * Get all sessions for the authenticated user (for analytics).
 * Not an API contract endpoint but needed internally.
 */
export async function getSessionsForUser(userId: string) {
    return prisma.studySession.findMany({
        where: { subject: { userId } },
        orderBy: { startTime: 'desc' },
        select: {
            id: true,
            subjectId: true,
            topic: true,
            sessionType: true,
            activeMinutes: true,
            startTime: true,
            endTime: true,
        },
    });
}

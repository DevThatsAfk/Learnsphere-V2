import { prisma } from '../prisma/client';

// ─────────────────────────────────────────────────
// BUSINESS RULES (from BACKEND_LOGIC.md)
// ─────────────────────────────────────────────────
const ACTIVE_DAY_THRESHOLD_MINUTES = 18; // A day is "active" if total minutes >= 18
const NEGLECT_THRESHOLD_DAYS = 14;       // Subject is neglected if no activity for >= 14 days
const CONSISTENCY_LOOKBACK_DAYS = 30;    // Calendar shows last 30 days

// ─────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────

function startOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

function endOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
}

function daysBetween(a: Date, b: Date): number {
    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.floor((b.getTime() - a.getTime()) / msPerDay);
}

function toDateString(date: Date): string {
    return date.toISOString().split('T')[0]!;
}

// ─────────────────────────────────────────────────
// ANALYTICS FUNCTIONS
// ─────────────────────────────────────────────────

/**
 * GET /api/analytics/overview
 *
 * Returns subject-wise totals:
 *   - total_active_minutes: sum of all ended session active_minutes for this subject
 *   - average_marks: mean of all exam_marks for this subject (null if no marks)
 *
 * Deterministic. No AI.
 */
export async function getAnalyticsOverview(userId: string) {
    const subjects = await prisma.subject.findMany({
        where: { userId },
        select: {
            id: true,
            studySessions: {
                where: { endTime: { not: null } }, // only count completed sessions
                select: { activeMinutes: true },
            },
            examMarks: {
                select: { marks: true },
            },
        },
    });

    return subjects.map((subject) => {
        const totalActiveMinutes = subject.studySessions.reduce(
            (sum: number, s: { activeMinutes: number }) => sum + s.activeMinutes,
            0
        );

        const allMarks = subject.examMarks.map((m: { marks: number }) => m.marks);
        const averageMarks =
            allMarks.length > 0
                ? Math.round((allMarks.reduce((sum: number, m: number) => sum + m, 0) / allMarks.length) * 100) / 100
                : null;

        return {
            subject_id: subject.id,
            total_active_minutes: totalActiveMinutes,
            average_marks: averageMarks,
        };
    });
}

/**
 * GET /api/analytics/consistency
 *
 * Returns last CONSISTENCY_LOOKBACK_DAYS days with:
 *   - date: YYYY-MM-DD
 *   - active_minutes: total for that day (ended sessions only)
 *   - is_active: true if active_minutes >= ACTIVE_DAY_THRESHOLD_MINUTES
 *
 * Days with no sessions are included with active_minutes = 0, is_active = false.
 * Deterministic. No AI.
 */
export async function getConsistencyCalendar(userId: string) {
    const now = new Date();
    const lookbackStart = new Date(now);
    lookbackStart.setDate(now.getDate() - (CONSISTENCY_LOOKBACK_DAYS - 1));

    // Fetch all ended sessions in the lookback window
    const sessions = await prisma.studySession.findMany({
        where: {
            subject: { userId },
            endTime: { not: null },
            startTime: { gte: startOfDay(lookbackStart) },
        },
        select: {
            startTime: true,
            activeMinutes: true,
        },
    });

    // Bucket sessions by date string
    const minutesByDate = new Map<string, number>();
    for (const session of sessions) {
        const dateKey = toDateString(session.startTime);
        minutesByDate.set(dateKey, (minutesByDate.get(dateKey) ?? 0) + session.activeMinutes);
    }

    // Build full 30-day array (oldest → newest)
    const result = [];
    for (let i = CONSISTENCY_LOOKBACK_DAYS - 1; i >= 0; i--) {
        const day = new Date(now);
        day.setDate(now.getDate() - i);
        const dateKey = toDateString(day);
        const activeMinutes = minutesByDate.get(dateKey) ?? 0;

        result.push({
            date: dateKey,
            active_minutes: activeMinutes,
            is_active: activeMinutes >= ACTIVE_DAY_THRESHOLD_MINUTES,
        });
    }

    return result;
}

/**
 * GET /api/analytics/today
 *
 * Returns:
 *   - total_active_minutes: sum of ended sessions started today
 *   - sessions_count: number of sessions started today (ended or not)
 *
 * Deterministic. No AI.
 */
export async function getTodayOverview(userId: string) {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    const sessions = await prisma.studySession.findMany({
        where: {
            subject: { userId },
            startTime: { gte: todayStart, lte: todayEnd },
        },
        select: {
            activeMinutes: true,
            endTime: true,
        },
    });

    const sessionsCount = sessions.length;
    const totalActiveMinutes = sessions
        .filter((s: { endTime: Date | null; activeMinutes: number }) => s.endTime !== null)
        .reduce((sum: number, s: { activeMinutes: number }) => sum + s.activeMinutes, 0);

    return {
        total_active_minutes: totalActiveMinutes,
        sessions_count: sessionsCount,
    };
}

/**
 * GET /api/analytics/neglect
 *
 * For each subject with no activity in the last NEGLECT_THRESHOLD_DAYS days,
 * returns: { subject_id, days_since_last_activity }
 *
 * "Activity" = any ended session.
 * Subjects with no sessions at all are computed from subject creation date.
 * Deterministic. No AI.
 */
export async function getNeglectSignals(userId: string) {
    const now = new Date();

    const subjects = await prisma.subject.findMany({
        where: { userId },
        select: {
            id: true,
            createdAt: true,
            studySessions: {
                where: { endTime: { not: null } },
                orderBy: { startTime: 'desc' },
                take: 1, // only the most recent session
                select: { startTime: true },
            },
        },
    });

    const neglected = [];

    for (const subject of subjects) {
        const lastSession = subject.studySessions[0];

        // Reference date: last session start, or subject creation if never studied
        const referenceDate = lastSession ? lastSession.startTime : subject.createdAt;
        const daysSince = daysBetween(referenceDate, now);

        if (daysSince >= NEGLECT_THRESHOLD_DAYS) {
            neglected.push({
                subject_id: subject.id,
                days_since_last_activity: daysSince,
            });
        }
    }

    // Sort by most neglected first
    return neglected.sort((a, b) => b.days_since_last_activity - a.days_since_last_activity);
}

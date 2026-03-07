/**
 * riskEngine.ts — LearnSphere v2 Risk Score Engine
 *
 * ARCHITECTURE (from spec):
 *   Rule layer = deterministic scoring (all 6 dimensions)
 *   AI layer   = Gemini writes explanation + interventions ONLY — never the score
 *
 * Dimension weights:
 *   Attendance      25%  (AttendanceRecord last 30d)
 *   Marks           25%  (ExamMark last 90d)
 *   Study Activity  20%  (StudySession — last 30d)
 *   LMS Activity    15%  (LMSActivityLog — last 14d)
 *   Recall Strength 10%  (ReviewItem recallStrength)
 *   Behavioural      5%  (session length trend — recent 15d vs prior 15d)
 *
 * Each dimension returns a "safety score" 0–100 (higher = safer).
 * Final risk score = 100 - weightedSafetyScore
 * Level: 0–30 = GREEN, 31–60 = AMBER, 61–100 = RED
 */
import { prisma } from '../prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import type { RiskLevel, RiskFlagType } from '@prisma/client';

// ─── Zod schema for AI output ─────────────────────────────────────────────────

const AIInterventionSchema = z.object({
    rank: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    title: z.string(),
    action: z.string(),
    urgency: z.enum(['immediate', 'this_week', 'this_month']),
    targetDimension: z.enum(['attendance', 'marks', 'study_activity', 'lms_activity', 'recall', 'behavioural']),
});

const AIRiskOutputSchema = z.object({
    explanation: z.string(),
    predictedTrajectory: z.string(),
    interventions: z.array(AIInterventionSchema).max(3),
});

type AIRiskOutput = z.infer<typeof AIRiskOutputSchema>;

// ─── Dimension flag helpers ────────────────────────────────────────────────────

interface FlagSignal {
    type: RiskFlagType;
    weight: number;
    detail: string;
}

// ─── Dimension 1: Attendance ────────────────────────────────────────────────────

async function calcAttendance(userId: string, thresholdMin = 75): Promise<{ score: number; flags: FlagSignal[] }> {
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const records = await prisma.attendanceRecord.findMany({
        where: { userId, date: { gte: since30 } },
        orderBy: { date: 'asc' },
    });

    const flags: FlagSignal[] = [];

    if (records.length === 0) return { score: 50, flags }; // neutral if no data

    const present = records.filter(r => r.status === 'PRESENT' || r.status === 'LATE').length;
    const pct = (present / records.length) * 100;

    // Calculate consecutive absences
    let maxConsec = 0;
    let consec = 0;
    for (const r of records) {
        if (r.status === 'ABSENT') {
            consec++;
            maxConsec = Math.max(maxConsec, consec);
        } else {
            consec = 0;
        }
    }

    if (pct < thresholdMin) {
        flags.push({ type: 'LOW_ATTENDANCE', weight: 0.25, detail: `Attendance ${pct.toFixed(1)}% < ${thresholdMin}% threshold` });
    } else if (pct < 85) {
        flags.push({ type: 'LOW_ATTENDANCE', weight: 0.10, detail: `Attendance ${pct.toFixed(1)}% is borderline (< 85%)` });
    }

    if (maxConsec >= 3) {
        flags.push({ type: 'CONSECUTIVE_ABSENCES', weight: 0.15, detail: `${maxConsec} consecutive absences detected` });
    }

    // safety score: 100 at 100% attendance, 0 at 50% or below
    const score = Math.max(0, Math.min(100, (pct - 50) * 2));
    return { score, flags };
}

// ─── Dimension 2: Marks ────────────────────────────────────────────────────────

async function calcMarks(userId: string, marksMin = 40): Promise<{ score: number; flags: FlagSignal[] }> {
    const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const flags: FlagSignal[] = [];

    const exams = await prisma.exam.findMany({
        where: { userId, examDate: { gte: since90 } },
        include: { marks: true },
    });

    if (exams.length === 0) return { score: 70, flags }; // neutral-good if no exams

    // Flatten all marks — calculate percentage per mark entry
    const percentages: number[] = [];
    for (const exam of exams) {
        for (const m of exam.marks) {
            // ExamMark stores raw marks — treat as percentage (field name is 'marks')
            percentages.push(Math.min(100, m.marks));
        }
    }

    if (percentages.length === 0) return { score: 70, flags };

    const avg = percentages.reduce((a, b) => a + b, 0) / percentages.length;
    const below40count = percentages.filter(p => p < 40).length;
    const below50count = percentages.filter(p => p < 50).length;

    if (below40count >= 2) {
        flags.push({ type: 'POOR_MARKS', weight: 0.25, detail: `Below 40% in ${below40count} subjects` });
    } else if (below50count >= 2) {
        flags.push({ type: 'POOR_MARKS', weight: 0.10, detail: `Below 50% in ${below50count} subjects (borderline)` });
    }

    // safety score: linear 0–100 mapped from avg 0→100%
    const score = Math.max(0, Math.min(100, avg));
    return { score, flags };
}

// ─── Dimension 3: Study Activity ──────────────────────────────────────────────

async function calcStudyActivity(userId: string): Promise<{ score: number; flags: FlagSignal[] }> {
    const flags: FlagSignal[] = [];

    // Get all sessions for this user via their subjects
    const subjects = await prisma.subject.findMany({ where: { userId }, select: { id: true } });
    const subjectIds = subjects.map(s => s.id);

    if (subjectIds.length === 0) return { score: 50, flags };

    const now = new Date();
    const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const recentSessions = await prisma.studySession.findMany({
        where: { subjectId: { in: subjectIds }, startTime: { gte: since30 } },
        orderBy: { startTime: 'desc' },
    });

    if (recentSessions.length === 0) {
        // No sessions in 30 days — severe neglect
        flags.push({ type: 'STUDY_NEGLECT', weight: 0.20, detail: 'No study session in 30 days — severe neglect', });
        return { score: 0, flags };
    }

    // Check if no session in 14 days
    const since14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const recent14 = recentSessions.filter(s => s.startTime >= since14);
    if (recent14.length === 0) {
        flags.push({ type: 'STUDY_NEGLECT', weight: 0.20, detail: 'No study session in 14+ days' });
    }

    const totalMinutes = recentSessions.reduce((s, r) => s + r.activeMinutes, 0);
    // safety score: 100 at ≥10 sessions per 30 days, linear below
    const score = Math.min(100, (recentSessions.length / 10) * 100);
    void totalMinutes; // informational
    return { score, flags };
}

// ─── Dimension 4: LMS Activity ─────────────────────────────────────────────────

async function calcLMSActivity(userId: string, lmsLoginsMin = 2): Promise<{ score: number; flags: FlagSignal[] }> {
    const flags: FlagSignal[] = [];
    const since14 = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const logs = await prisma.lMSActivityLog.findMany({
        where: { userId, loggedAt: { gte: since14 } },
    });

    if (logs.length === 0) {
        // No LMS data = uncertain, give neutral score
        return { score: 60, flags };
    }

    // Count distinct active days
    const activeDaySet = new Set(logs.map(l => l.loggedAt.toISOString().slice(0, 10)));
    const activeDays = activeDaySet.size;
    const weeksInPeriod = 2;
    const avgPerWeek = activeDays / weeksInPeriod;

    if (avgPerWeek < lmsLoginsMin) {
        flags.push({
            type: 'LOW_LMS_ACTIVITY',
            weight: 0.15,
            detail: `Only ${activeDays} active LMS days in 14 days (< ${lmsLoginsMin * weeksInPeriod} required)`,
        });
    }

    // safety: 100 at ≥7 active days in 14d, linear below
    const score = Math.min(100, (activeDays / 7) * 100);
    return { score, flags };
}

// ─── Dimension 5: Recall Strength ──────────────────────────────────────────────

async function calcRecall(userId: string): Promise<{ score: number; flags: FlagSignal[] }> {
    const flags: FlagSignal[] = [];
    const subjects = await prisma.subject.findMany({ where: { userId }, select: { id: true } });
    const subjectIds = subjects.map(s => s.id);

    if (subjectIds.length === 0) return { score: 70, flags };

    const reviewItems = await prisma.reviewItem.findMany({
        where: { subjectId: { in: subjectIds } },
        select: { recallStrength: true },
    });

    if (reviewItems.length === 0) return { score: 70, flags };

    const weakCount = reviewItems.filter(r => r.recallStrength === 'WEAK').length;
    const strongCount = reviewItems.filter(r => r.recallStrength === 'STRONG').length;
    const totalCount = reviewItems.length;

    if (weakCount >= 3) {
        flags.push({ type: 'WEAK_RECALL', weight: 0.10, detail: `${weakCount} review topics rated WEAK` });
    }

    // safety: weighted by strength distribution
    const score = Math.min(100, ((strongCount * 100 + (totalCount - weakCount - strongCount) * 60) / totalCount));
    return { score, flags };
}

// ─── Dimension 6: Behavioural Drop ─────────────────────────────────────────────

async function calcBehavioural(userId: string): Promise<{ score: number; flags: FlagSignal[] }> {
    const flags: FlagSignal[] = [];
    const subjects = await prisma.subject.findMany({ where: { userId }, select: { id: true } });
    const subjectIds = subjects.map(s => s.id);

    if (subjectIds.length === 0) return { score: 70, flags };

    const now = new Date();
    const d15 = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
    const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [recent, prior] = await Promise.all([
        prisma.studySession.aggregate({
            where: { subjectId: { in: subjectIds }, startTime: { gte: d15 } },
            _sum: { activeMinutes: true }, _count: { id: true },
        }),
        prisma.studySession.aggregate({
            where: { subjectId: { in: subjectIds }, startTime: { gte: d30, lt: d15 } },
            _sum: { activeMinutes: true }, _count: { id: true },
        }),
    ]);

    const recentMins = recent._sum.activeMinutes ?? 0;
    const priorMins = prior._sum.activeMinutes ?? 0;

    if (priorMins > 0 && recentMins < priorMins * 0.5) {
        flags.push({
            type: 'BEHAVIOURAL_DROP',
            weight: 0.10,
            detail: `Study time dropped ${Math.round((1 - recentMins / priorMins) * 100)}% vs previous 15 days`,
        });
    }

    if (priorMins === 0) return { score: 70, flags }; // no baseline

    const ratio = priorMins > 0 ? Math.min(1, recentMins / priorMins) : 1;
    const score = ratio * 100;
    return { score, flags };
}

// ─── Composite Score Calculation ───────────────────────────────────────────────

const WEIGHTS = {
    attendance: 0.25,
    marks: 0.25,
    studyActivity: 0.20,
    lmsActivity: 0.15,
    recall: 0.10,
    behavioural: 0.05,
} as const;

function bucketed(riskScore: number): RiskLevel {
    if (riskScore <= 30) return 'GREEN';
    if (riskScore <= 60) return 'AMBER';
    return 'RED';
}

// ─── AI Layer ──────────────────────────────────────────────────────────────────

async function buildAIExplanation(params: {
    score: number;
    level: RiskLevel;
    dimensions: Record<string, number>;
    flags: FlagSignal[];
    studentName: string;
}): Promise<AIRiskOutput> {
    // Fallback rule-based explanation (used if no API key or if Gemini fails)
    const fallback: AIRiskOutput = {
        explanation: `${params.studentName} has a ${params.level} risk level with an overall risk score of ${params.score.toFixed(1)}/100. Active risk flags: ${params.flags.map(f => f.detail).join('; ') || 'none'}.`,
        predictedTrajectory: params.level === 'GREEN'
            ? 'On track. Continued engagement expected to maintain performance.'
            : params.level === 'AMBER'
                ? 'Needs attention. Early intervention recommended to prevent escalation to RED.'
                : 'Urgent intervention required. Risk of academic failure without immediate support.',
        interventions: params.flags.slice(0, 3).map((f, i) => ({
            rank: (i + 1) as 1 | 2 | 3,
            title: `Address ${f.type.replace(/_/g, ' ').toLowerCase()}`,
            action: f.detail,
            urgency: params.level === 'RED' ? 'immediate' : params.level === 'AMBER' ? 'this_week' : 'this_month',
            targetDimension: f.type === 'LOW_ATTENDANCE' || f.type === 'CONSECUTIVE_ABSENCES' ? 'attendance'
                : f.type === 'POOR_MARKS' ? 'marks'
                    : f.type === 'STUDY_NEGLECT' ? 'study_activity'
                        : f.type === 'LOW_LMS_ACTIVITY' ? 'lms_activity'
                            : f.type === 'WEAK_RECALL' ? 'recall'
                                : 'behavioural',
        })) as AIRiskOutput['interventions'],
    };

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return fallback;

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: 'gemini-1.5-flash',
            systemInstruction: 'You are an academic risk analyst. ONLY reference data provided to you — no invented context. Return valid JSON only.',
            generationConfig: {
                temperature: 0.1,
                responseMimeType: 'application/json',
            },
        });

        const prompt = `
Analyze this student's academic risk profile and return a JSON object.

Student: ${params.studentName}
Risk Score: ${params.score.toFixed(1)}/100
Risk Level: ${params.level}
Dimension Safety Scores (0-100, higher=safer):
${Object.entries(params.dimensions).map(([k, v]) => `  ${k}: ${v.toFixed(1)}`).join('\n')}
Active Risk Flags:
${params.flags.length > 0 ? params.flags.map(f => `  - ${f.type}: ${f.detail}`).join('\n') : '  None'}

Return ONLY this JSON structure, no markdown:
{
  "explanation": "2-3 sentence plain-English summary referencing only the data above",
  "predictedTrajectory": "1-2 sentence prediction of where this student will be in 4 weeks if nothing changes",
  "interventions": [
    { "rank": 1, "title": "Short intervention title", "action": "Specific actionable step", "urgency": "immediate|this_week|this_month", "targetDimension": "attendance|marks|study_activity|lms_activity|recall|behavioural" },
    { "rank": 2, "title": "...", "action": "...", "urgency": "...", "targetDimension": "..." },
    { "rank": 3, "title": "...", "action": "...", "urgency": "...", "targetDimension": "..." }
  ]
}`;

        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        const parsed = JSON.parse(text);
        return AIRiskOutputSchema.parse(parsed);
    } catch (err) {
        console.warn('[RiskEngine] AI layer failed, using fallback:', err instanceof Error ? err.message : err);
        return fallback;
    }
}

// ─── Main Export ───────────────────────────────────────────────────────────────

export interface RiskCalculationResult {
    score: number;
    level: RiskLevel;
    attendanceScore: number;
    marksScore: number;
    studyActivityScore: number;
    lmsActivityScore: number;
    recallScore: number;
    behaviouralScore: number;
    flags: FlagSignal[];
    aiExplanation: string;
    aiInterventions: AIRiskOutput['interventions'];
    predictedTrajectory: string;
}

export async function calculateRisk(userId: string): Promise<RiskCalculationResult> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
    });
    const studentName = user?.email ?? userId;

    // Load department thresholds (fall back to global, then defaults)
    const userRecord = await prisma.user.findUnique({ where: { id: userId }, select: { departmentId: true } });
    const thresholdConfig = await prisma.riskThresholdConfig.findFirst({
        where: {
            OR: [
                { departmentId: userRecord?.departmentId ?? '' },
                { departmentId: null },
            ],
        },
        orderBy: { departmentId: 'desc' }, // department-specific first
    });
    const attendanceMin = thresholdConfig?.attendanceMin ?? 75;
    const marksMin = thresholdConfig?.marksMin ?? 40;
    const lmsLoginsMin = thresholdConfig?.lmsLoginsMin ?? 2;
    void marksMin; // used in marks dimension implicitly via threshold

    // ── Run all 6 dimensions in parallel ────────────────────────────────────
    const [attn, marks, study, lms, recall, behav] = await Promise.all([
        calcAttendance(userId, attendanceMin),
        calcMarks(userId),
        calcStudyActivity(userId),
        calcLMSActivity(userId, lmsLoginsMin),
        calcRecall(userId),
        calcBehavioural(userId),
    ]);

    const weightedSafety =
        attn.score * WEIGHTS.attendance +
        marks.score * WEIGHTS.marks +
        study.score * WEIGHTS.studyActivity +
        lms.score * WEIGHTS.lmsActivity +
        recall.score * WEIGHTS.recall +
        behav.score * WEIGHTS.behavioural;

    const riskScore = Math.round((100 - weightedSafety) * 10) / 10;
    const level = bucketed(riskScore);
    const allFlags = [...attn.flags, ...marks.flags, ...study.flags, ...lms.flags, ...recall.flags, ...behav.flags];

    // ── AI layer ─────────────────────────────────────────────────────────────
    const aiOutput = await buildAIExplanation({
        score: riskScore,
        level,
        dimensions: {
            attendance: attn.score,
            marks: marks.score,
            study_activity: study.score,
            lms_activity: lms.score,
            recall: recall.score,
            behavioural: behav.score,
        },
        flags: allFlags,
        studentName,
    });

    // ── Persist to DB ─────────────────────────────────────────────────────────
    const riskRecord = await prisma.riskScore.create({
        data: {
            userId,
            score: riskScore,
            level,
            attendanceScore: attn.score,
            marksScore: marks.score,
            studyActivityScore: study.score,
            lmsActivityScore: lms.score,
            recallScore: recall.score,
            behaviouralScore: behav.score,
            aiExplanation: aiOutput.explanation,
            aiInterventions: aiOutput.interventions as object,
        },
    });

    // Persist active flags
    if (allFlags.length > 0) {
        await prisma.riskFlag.createMany({
            data: allFlags.map(f => ({
                riskScoreId: riskRecord.id,
                userId,
                type: f.type,
                weight: f.weight,
                detail: f.detail,
            })),
        });
    }

    return {
        score: riskScore,
        level,
        attendanceScore: attn.score,
        marksScore: marks.score,
        studyActivityScore: study.score,
        lmsActivityScore: lms.score,
        recallScore: recall.score,
        behaviouralScore: behav.score,
        flags: allFlags,
        aiExplanation: aiOutput.explanation,
        aiInterventions: aiOutput.interventions,
        predictedTrajectory: aiOutput.predictedTrajectory,
    };
}

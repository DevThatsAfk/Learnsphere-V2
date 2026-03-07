/**
 * interventionService.ts — Intervention lifecycle management.
 *
 * Flow (from spec):
 *   1. Risk engine detects RED (score > 60)
 *   2. EDUCATOR creates intervention plan (can use AI draft)
 *   3. HOD reviews → approves or modifies
 *   4. Plan sent to student dashboard
 *   5. Parent notified (via notificationService)
 *   6. Advisor logs counselling notes if meeting occurs
 *   7. After 7 days: cron job recalculates risk, logs outcome delta
 */
import { prisma } from '../prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { ApiError } from '../middleware/errorHandler';
import type { InterventionStatus } from '@prisma/client';

// Zod schema for AI-generated intervention plan
const AIPlanSchema = z.object({
    plan: z.string(),
    urgency: z.enum(['immediate', 'this_week', 'this_month']),
    steps: z.array(z.string()).max(5),
});

/** Generate an AI draft intervention plan for a student */
export async function generateAIInterventionDraft(studentId: string, riskScoreId: string): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;

    // Load context
    const [student, riskScore] = await Promise.all([
        prisma.user.findUnique({ where: { id: studentId }, select: { email: true, rollNumber: true } }),
        prisma.riskScore.findUnique({ where: { id: riskScoreId }, include: { flags: true } }),
    ]);

    if (!riskScore) throw new ApiError(404, 'Risk score not found.', 'NOT_FOUND');

    const fallbackPlan = [
        `Intervention plan for student ${student?.email ?? studentId}`,
        `Risk Score: ${riskScore.score.toFixed(1)} (${riskScore.level})`,
        `Active concerns: ${riskScore.flags.map(f => f.detail).join('; ')}`,
        '',
        'Recommended steps:',
        '1. Schedule 1:1 meeting with student within 48 hours',
        '2. Review attendance and study patterns together',
        '3. Create a structured study schedule',
        '4. Set weekly check-in milestones',
        '5. Coordinate with parent/guardian if no improvement in 7 days',
    ].join('\n');

    if (!apiKey) return fallbackPlan;

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: 'gemini-1.5-flash',
            systemInstruction: 'You are an academic advisor creating intervention plans. Be specific and actionable.',
            generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
        });

        const prompt = `
Create an intervention plan for this at-risk student. Return JSON only.

Student: ${student?.email ?? studentId}
Risk Score: ${riskScore.score.toFixed(1)} / 100 (${riskScore.level})
Active Risk Flags:
${riskScore.flags.map(f => `  - ${f.type}: ${f.detail}`).join('\n') || '  None'}

Dimension Safety Scores:
  Attendance: ${riskScore.attendanceScore.toFixed(1)}
  Marks: ${riskScore.marksScore.toFixed(1)}
  Study Activity: ${riskScore.studyActivityScore.toFixed(1)}
  LMS Activity: ${riskScore.lmsActivityScore.toFixed(1)}
  Recall: ${riskScore.recallScore.toFixed(1)}
  Behavioural: ${riskScore.behaviouralScore.toFixed(1)}

Return: { "plan": "2-3 paragraph intervention plan text", "urgency": "immediate|this_week|this_month", "steps": ["step 1", "step 2", "step 3", "step 4", "step 5"] }`;

        const result = await model.generateContent(prompt);
        const parsed = AIPlanSchema.parse(JSON.parse(result.response.text().trim()));
        return [parsed.plan, '', 'Action Steps:', ...parsed.steps.map((s, i) => `${i + 1}. ${s}`)].join('\n');
    } catch (err) {
        console.warn('[InterventionService] AI draft failed, using fallback:', err instanceof Error ? err.message : err);
        return fallbackPlan;
    }
}

/** Create a new intervention for a student */
export async function createIntervention(params: {
    studentId: string;
    educatorId: string;
    riskScoreId: string;
    educatorNote?: string;
    useAIDraft?: boolean;
}) {
    const { studentId, educatorId, riskScoreId, educatorNote, useAIDraft } = params;

    let aiPlan: string | undefined;
    if (useAIDraft) {
        aiPlan = await generateAIInterventionDraft(studentId, riskScoreId);
    }

    return prisma.intervention.create({
        data: {
            studentId,
            educatorId,
            riskScoreId,
            aiPlan,
            educatorNote,
            status: 'PENDING_REVIEW',
        },
    });
}

/** Get a single intervention, verifying it exists */
export async function getIntervention(id: string) {
    const intervention = await prisma.intervention.findUnique({
        where: { id },
        include: {
            student: { select: { id: true, email: true, rollNumber: true } },
            educator: { select: { id: true, email: true } },
            outcome: true,
        },
    });
    if (!intervention) throw new ApiError(404, 'Intervention not found.', 'NOT_FOUND');
    return intervention;
}

/** HOD approves/modifies and sends to student */
export async function approveIntervention(id: string, finalPlan?: string): Promise<void> {
    const status: InterventionStatus = finalPlan ? 'MODIFIED_SENT' : 'APPROVED';
    await prisma.intervention.update({
        where: { id },
        data: { status, finalPlan: finalPlan ?? undefined, sentAt: new Date() },
    });

    // Notify parent about approved intervention
    const intervention = await prisma.intervention.findUnique({
        where: { id },
        include: { student: { select: { id: true, email: true } } },
    });
    if (intervention?.student) {
        const { notifyStudentRedRisk } = await import('./notificationService');
        notifyStudentRedRisk(
            intervention.student.id,
            intervention.student.email,
            0, // score unknown at this point — just notify of intervention being sent
            'An intervention plan has been approved and sent to you'
        ).catch(() => { });
    }
}

/** Process 7-day follow-ups — called by cron job */
export async function process7DayFollowUps(): Promise<{ processed: number; outcomes: string[] }> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const { calculateRisk } = await import('./riskEngine');

    // Find interventions that were sent 7+ days ago and not yet followed up
    const due = await prisma.intervention.findMany({
        where: {
            sentAt: { lte: sevenDaysAgo },
            status: { in: ['APPROVED', 'MODIFIED_SENT', 'ACKNOWLEDGED'] },
            outcome: null,
        },
        include: { student: { select: { id: true } } },
    });

    const outcomes: string[] = [];

    for (const intervention of due) {
        try {
            // Recalculate risk
            const newRisk = await calculateRisk(intervention.studentId);

            // Get the original risk score
            const originalRisk = await prisma.riskScore.findUnique({
                where: { id: intervention.riskScoreId },
                select: { score: true },
            });

            const deltaScore = originalRisk ? newRisk.score - originalRisk.score : null;

            await prisma.interventionOutcome.create({
                data: {
                    interventionId: intervention.id,
                    followUpScore: newRisk.score,
                    deltaScore: deltaScore,
                    resolvedAt: new Date(),
                },
            });

            const status = deltaScore !== null && deltaScore < 0 ? '✅ improved' : '⚠️ unchanged/worsened';
            outcomes.push(`Intervention ${intervention.id}: ${status} (delta: ${deltaScore?.toFixed(1) ?? 'N/A'})`);
        } catch (err) {
            outcomes.push(`Intervention ${intervention.id}: ERROR — ${err instanceof Error ? err.message : 'unknown'}`);
        }
    }

    return { processed: due.length, outcomes };
}

/**
 * notificationService.ts — In-app + email notifications for critical risk alerts.
 *
 * Sends email via nodemailer (SMTP configured in .env).
 * Falls back gracefully if SMTP not configured (dev mode).
 */
import nodemailer from 'nodemailer';

interface AlertNotification {
    toEmail: string;
    toName: string;
    studentName: string;
    riskLevel: 'AMBER' | 'RED';
    riskScore: number;
    topFlag: string;
    actionUrl?: string;
}

function createTransporter() {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
        return null; // SMTP not configured — silent in dev
    }
    return nodemailer.createTransport({
        host: SMTP_HOST,
        port: parseInt(SMTP_PORT ?? '587'),
        secure: false, // TLS
        auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
}

export async function sendRiskAlert(notification: AlertNotification): Promise<void> {
    const transporter = createTransporter();
    if (!transporter) {
        console.log(`[Notifications] SMTP not configured — would have sent alert to ${notification.toEmail}`);
        return;
    }

    const levelEmoji = notification.riskLevel === 'RED' ? '🔴' : '🟡';
    const subject = `${levelEmoji} LearnSphere Alert: ${notification.studentName} is at ${notification.riskLevel} risk`;

    const html = `
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: ${notification.riskLevel === 'RED' ? '#7f1d1d' : '#78350f'}; padding: 24px; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 22px;">
                    ${levelEmoji} ${notification.riskLevel} Risk Alert
                </h1>
            </div>
            <div style="background: #1e293b; padding: 24px; border-radius: 0 0 12px 12px; color: #cbd5e1;">
                <p>Dear ${notification.toName},</p>
                <p><strong style="color: #f1f5f9;">${notification.studentName}</strong> has been flagged as <strong style="color: ${notification.riskLevel === 'RED' ? '#f87171' : '#fbbf24'};">${notification.riskLevel} risk</strong> by LearnSphere's academic monitoring system.</p>
                <div style="background: #0f172a; border-radius: 8px; padding: 16px; margin: 16px 0;">
                    <p style="margin: 0; font-size: 14px;"><strong>Risk Score:</strong> ${notification.riskScore.toFixed(1)} / 100</p>
                    <p style="margin: 8px 0 0; font-size: 14px;"><strong>Primary Concern:</strong> ${notification.topFlag}</p>
                </div>
                ${notification.actionUrl ? `<a href="${notification.actionUrl}" style="display: inline-block; background: #4f46e5; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">View Full Report →</a>` : ''}
                <p style="font-size: 12px; color: #64748b; margin-top: 24px;">This is an automated alert from LearnSphere. Please log in to view the full risk breakdown and intervention options.</p>
            </div>
        </div>
    `;

    try {
        await transporter.sendMail({
            from: `"LearnSphere Alerts" <${process.env.SMTP_USER}>`,
            to: notification.toEmail,
            subject,
            html,
        });
        console.log(`[Notifications] Alert email sent to ${notification.toEmail}`);
    } catch (err) {
        console.error(`[Notifications] Failed to send email to ${notification.toEmail}:`, err instanceof Error ? err.message : err);
    }
}

/**
 * Notify all parents and assigned advisor of a student when they hit RED risk.
 */
export async function notifyStudentRedRisk(
    studentId: string,
    studentEmail: string,
    riskScore: number,
    topFlag: string
): Promise<void> {
    const { prisma } = await import('../prisma/client');

    // Find all parents
    const parentLinks = await prisma.parentStudentLink.findMany({
        where: { studentId },
        include: { parent: { select: { email: true } } },
    });

    // Find assigned advisors
    const advisorLinks = await prisma.advisorAssignment.findMany({
        where: { studentId },
        include: { advisor: { select: { email: true } } },
    });

    const notifyList = [
        ...parentLinks.map(l => ({ email: l.parent.email, name: 'Parent/Guardian' })),
        ...advisorLinks.map(l => ({ email: l.advisor.email, name: 'Advisor' })),
    ];

    for (const recipient of notifyList) {
        await sendRiskAlert({
            toEmail: recipient.email,
            toName: recipient.name,
            studentName: studentEmail,
            riskLevel: 'RED',
            riskScore,
            topFlag,
        });
    }
}

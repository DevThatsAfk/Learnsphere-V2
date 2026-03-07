/**
 * naacReportService.ts — Phase 6: NAAC PDF report generator.
 *
 * Generates a structured PDF at the criteria level:
 *   - Criterion 5: Student Support (at-risk monitoring, interventions)
 *   - Criterion 6: Governance (system overview, LMS usage)
 *
 * Output: Buffer (Express can stream it directly to the client).
 */
import PDFDocument from 'pdfkit';
import { prisma } from '../prisma/client';

interface NAACStat {
    totalStudents: number;
    atRisk: number;
    interventionsTotal: number;
    interventionsResolved: number;
    interventionImprovedPct: number;
    avgAttendancePct: number;
    lmsUsersLast30d: number;
}

async function gatherStats(): Promise<NAACStat> {
    const totalStudents = await prisma.user.count({ where: { role: 'STUDENT' } });

    // At risk = latest risk score is RED or AMBER
    const atRiskScores = await prisma.riskScore.findMany({
        where: { level: { in: ['RED', 'AMBER'] } },
        distinct: ['userId'],
    });

    const interventionsTotal = await prisma.intervention.count();
    const interventionsResolved = await prisma.intervention.count({ where: { status: 'COMPLETED' } });
    const outcomes = await prisma.interventionOutcome.findMany({ select: { deltaScore: true } });
    const improved = outcomes.filter(o => (o.deltaScore ?? 0) < 0).length;
    const interventionImprovedPct = outcomes.length > 0 ? Math.round((improved / outcomes.length) * 100) : 0;

    // Average attendance across all records in last 90 days
    const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const [totalRecords, presentRecords] = await Promise.all([
        prisma.attendanceRecord.count({ where: { date: { gte: since90 } } }),
        prisma.attendanceRecord.count({ where: { date: { gte: since90 }, status: { in: ['PRESENT', 'LATE'] } } }),
    ]);
    const avgAttendancePct = totalRecords > 0 ? Math.round((presentRecords / totalRecords) * 100) : 0;

    // LMS logins last 30 days
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const lmsUsers = await prisma.lMSActivityLog.groupBy({
        by: ['userId'],
        where: { loggedAt: { gte: since30 } },
    });

    return {
        totalStudents,
        atRisk: atRiskScores.length,
        interventionsTotal,
        interventionsResolved,
        interventionImprovedPct,
        avgAttendancePct,
        lmsUsersLast30d: lmsUsers.length,
    };
}

function line(doc: PDFKit.PDFDocument, y: number) {
    doc.moveTo(50, y).lineTo(doc.page.width - 50, y).strokeColor('#334155').lineWidth(0.5).stroke();
}

function heading(doc: PDFKit.PDFDocument, text: string) {
    doc.moveDown(0.5)
        .fontSize(14).fillColor('#6366f1').font('Helvetica-Bold').text(text)
        .moveDown(0.2);
    line(doc, doc.y);
    doc.moveDown(0.3);
}

function stat(doc: PDFKit.PDFDocument, label: string, value: string) {
    doc.fontSize(10).fillColor('#94a3b8').font('Helvetica').text(label, { continued: true });
    doc.fillColor('#f1f5f9').font('Helvetica-Bold').text(`  ${value}`);
}

export async function generateNAACPDF(): Promise<Buffer> {
    const stats = await gatherStats();
    const now = new Date();

    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        const doc = new PDFDocument({ margin: 50, size: 'A4' });

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // ─── Cover ────────────────────────────────────────────────────────────
        doc.rect(0, 0, doc.page.width, 120).fill('#0f172a');
        doc.fillColor('#6366f1').fontSize(22).font('Helvetica-Bold').text('LearnSphere', 50, 35);
        doc.fillColor('#f1f5f9').fontSize(14).font('Helvetica').text('Academic Risk Monitoring — NAAC Self-Study Report', 50, 65);
        doc.fillColor('#94a3b8').fontSize(10).text(`Generated: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}   |   Academic Year: ${now.getFullYear()}`, 50, 90);

        doc.moveDown(2);

        // ─── Criterion 5: Student Support ─────────────────────────────────────
        heading(doc, 'Criterion 5 — Student Support and Progression');

        doc.fontSize(10).fillColor('#94a3b8').font('Helvetica').text('5.1  Academic Risk Monitoring System', { oblique: false });
        doc.moveDown(0.2);
        doc.fontSize(10).fillColor('#cbd5e1').text(
            'LearnSphere v2 implements an automated 6-dimension risk scoring engine that continuously monitors ' +
            'student performance across attendance, marks, study activity, LMS engagement, recall strength, ' +
            'and behavioural patterns. Risk levels are classified as GREEN, AMBER, or RED.'
        );

        doc.moveDown(0.5);
        stat(doc, 'Total Student Population:', String(stats.totalStudents));
        stat(doc, 'Students Currently At-Risk (AMBER or RED):', `${stats.atRisk} (${stats.totalStudents > 0 ? Math.round((stats.atRisk / stats.totalStudents) * 100) : 0}%)`);
        stat(doc, 'Average Attendance Rate (90 days):', `${stats.avgAttendancePct}%`);

        doc.moveDown(0.5);
        doc.fontSize(10).fillColor('#94a3b8').text('5.2  Intervention & Counselling System');
        doc.moveDown(0.2);
        doc.fontSize(10).fillColor('#cbd5e1').text(
            'Educator-initiated intervention plans (with optional AI draft via Gemini 1.5) are reviewed and approved ' +
            'by the Head of Department before delivery to students. Outcome tracking includes 7-day follow-up ' +
            'risk recalculation to measure intervention effectiveness.'
        );
        doc.moveDown(0.5);
        stat(doc, 'Total Interventions Created:', String(stats.interventionsTotal));
        stat(doc, 'Interventions Completed:', String(stats.interventionsResolved));
        stat(doc, 'Improvement Rate (risk reduced after 7 days):', `${stats.interventionImprovedPct}%`);

        // ─── Criterion 6: Governance ───────────────────────────────────────────
        heading(doc, 'Criterion 6 — Governance, Leadership and Management');

        doc.fontSize(10).fillColor('#94a3b8').text('6.2  LMS Integration and Digital Learning');
        doc.moveDown(0.2);
        doc.fontSize(10).fillColor('#cbd5e1').text(
            'LearnSphere integrates with institutional LMS platforms (Moodle, Google Classroom) and supports ' +
            'CSV bulk import for attendance and activity data. Multi-role access (Student, Parent, Educator, ' +
            'Advisor, HoD, Admin) ensures appropriate data visibility and accountability.'
        );
        doc.moveDown(0.5);
        stat(doc, 'Active LMS Users (past 30 days):', String(stats.lmsUsersLast30d));

        // ─── Footer ───────────────────────────────────────────────────────────
        doc.moveDown(2);
        line(doc, doc.y);
        doc.moveDown(0.3);
        doc.fontSize(9).fillColor('#64748b').text(
            'This report was auto-generated by LearnSphere v2. Data reflects live database readings at time of generation.'
        );

        doc.end();
    });
}

/**
 * v2TestSeed.ts — Comprehensive E2E test dataset for LearnSphere v2
 *
 * Creates: 2 departments, 22 users (all roles), exact risk profiles,
 * interventions, counselling notes, LMS logs, and runs risk calculation.
 *
 * Run: npx ts-node --transpile-only src/seeds/v2TestSeed.ts
 */

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { calculateRisk } from '../services/riskEngine';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const h = (pw: string) => bcrypt.hash(pw, 10);

function daysAgo(n: number): Date {
    return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

async function main() {
    console.log('🌱 LearnSphere v2 E2E Test Seed\n');

    // ── 1. Departments ────────────────────────────────────────────
    const cs = await prisma.department.upsert({
        where: { name: 'Computer Science' },
        update: {},
        create: { name: 'Computer Science' },
    });
    const ee = await prisma.department.upsert({
        where: { name: 'Electronics Engineering' },
        update: {},
        create: { name: 'Electronics Engineering' },
    });
    console.log(`✅ Departments: ${cs.name}, ${ee.name}`);

    // ── 2. Create all users ───────────────────────────────────────
    const userData = [
        { email: 'admin@learnsphere.test', pw: 'Admin@123', role: 'ADMIN' as const, dept: cs.id },
        { email: 'hod.cs@learnsphere.test', pw: 'Hod@12345', role: 'HOD' as const, dept: cs.id },
        { email: 'hod.ee@learnsphere.test', pw: 'Hod@12345', role: 'HOD' as const, dept: ee.id },
        { email: 'edu.priya@learnsphere.test', pw: 'Edu@12345', role: 'EDUCATOR' as const, dept: cs.id },
        { email: 'edu.ravi@learnsphere.test', pw: 'Edu@12345', role: 'EDUCATOR' as const, dept: cs.id },
        { email: 'edu.suma@learnsphere.test', pw: 'Edu@12345', role: 'EDUCATOR' as const, dept: ee.id },
        { email: 'edu.mani@learnsphere.test', pw: 'Edu@12345', role: 'EDUCATOR' as const, dept: ee.id },
        { email: 'advisor.cs@learnsphere.test', pw: 'Adv@12345', role: 'ADVISOR' as const, dept: cs.id },
        { email: 'advisor.ee@learnsphere.test', pw: 'Adv@12345', role: 'ADVISOR' as const, dept: ee.id },
        // CS Students
        { email: 'student.red1@learnsphere.test', pw: 'Student@123', role: 'STUDENT' as const, dept: cs.id, roll: 'CS001', year: 2, section: 'A' },
        { email: 'student.red2@learnsphere.test', pw: 'Student@123', role: 'STUDENT' as const, dept: cs.id, roll: 'CS002', year: 2, section: 'A' },
        { email: 'student.amber1@learnsphere.test', pw: 'Student@123', role: 'STUDENT' as const, dept: cs.id, roll: 'CS003', year: 2, section: 'A' },
        { email: 'student.amber2@learnsphere.test', pw: 'Student@123', role: 'STUDENT' as const, dept: cs.id, roll: 'CS004', year: 2, section: 'A' },
        { email: 'student.green1@learnsphere.test', pw: 'Student@123', role: 'STUDENT' as const, dept: cs.id, roll: 'CS005', year: 2, section: 'B' },
        { email: 'student.green2@learnsphere.test', pw: 'Student@123', role: 'STUDENT' as const, dept: cs.id, roll: 'CS006', year: 2, section: 'B' },
        { email: 'student.recovered1@learnsphere.test', pw: 'Student@123', role: 'STUDENT' as const, dept: cs.id, roll: 'CS007', year: 2, section: 'B' },
        { email: 'student.recovered2@learnsphere.test', pw: 'Student@123', role: 'STUDENT' as const, dept: cs.id, roll: 'CS008', year: 2, section: 'B' },
        // EE Students
        { email: 'student.amber3@learnsphere.test', pw: 'Student@123', role: 'STUDENT' as const, dept: ee.id, roll: 'EE001', year: 2, section: 'A' },
        { email: 'student.green3@learnsphere.test', pw: 'Student@123', role: 'STUDENT' as const, dept: ee.id, roll: 'EE002', year: 2, section: 'A' },
        // Parents
        { email: 'parent.aryan@learnsphere.test', pw: 'Parent@123', role: 'PARENT' as const, dept: cs.id },
        { email: 'parent.rohit@learnsphere.test', pw: 'Parent@123', role: 'PARENT' as const, dept: cs.id },
    ];

    const users: Record<string, { id: string; email: string }> = {};
    for (const u of userData) {
        const { email, pw, role, dept, roll, year, section } = u as typeof u & { roll?: string; year?: number; section?: string };
        const rec = await prisma.user.upsert({
            where: { email },
            update: { role, passwordHash: await h(pw), departmentId: dept, rollNumber: roll, yearOfStudy: year, section },
            create: { email, passwordHash: await h(pw), role, departmentId: dept, rollNumber: roll, yearOfStudy: year, section },
        });
        users[email] = rec;
        console.log(`  ✓ ${role.padEnd(8)} ${email}`);
    }

    // ── 3. Set HoDs ───────────────────────────────────────────────
    await prisma.department.update({ where: { id: cs.id }, data: { hodId: users['hod.cs@learnsphere.test'].id } });
    await prisma.department.update({ where: { id: ee.id }, data: { hodId: users['hod.ee@learnsphere.test'].id } });

    // ── 4. Parent → Student links ─────────────────────────────────
    await prisma.parentStudentLink.upsert({
        where: { parentId_studentId: { parentId: users['parent.aryan@learnsphere.test'].id, studentId: users['student.red1@learnsphere.test'].id } },
        update: {},
        create: { parentId: users['parent.aryan@learnsphere.test'].id, studentId: users['student.red1@learnsphere.test'].id, relation: 'guardian', isPrimary: true },
    });
    await prisma.parentStudentLink.upsert({
        where: { parentId_studentId: { parentId: users['parent.rohit@learnsphere.test'].id, studentId: users['student.amber1@learnsphere.test'].id } },
        update: {},
        create: { parentId: users['parent.rohit@learnsphere.test'].id, studentId: users['student.amber1@learnsphere.test'].id, relation: 'guardian', isPrimary: true },
    });
    console.log('\n✅ Parent links created');

    // ── 5. Advisor → Student assignments ──────────────────────────
    const csAdvisorId = users['advisor.cs@learnsphere.test'].id;
    const eeAdvisorId = users['advisor.ee@learnsphere.test'].id;
    const csAssignments = ['student.red1@learnsphere.test', 'student.red2@learnsphere.test', 'student.amber1@learnsphere.test', 'student.amber2@learnsphere.test', 'student.recovered1@learnsphere.test', 'student.recovered2@learnsphere.test'];
    const eeAssignments = ['student.amber3@learnsphere.test', 'student.green3@learnsphere.test'];

    for (const email of csAssignments) {
        await prisma.advisorAssignment.upsert({
            where: { advisorId_studentId: { advisorId: csAdvisorId, studentId: users[email].id } },
            update: {},
            create: { advisorId: csAdvisorId, studentId: users[email].id },
        });
    }
    for (const email of eeAssignments) {
        await prisma.advisorAssignment.upsert({
            where: { advisorId_studentId: { advisorId: eeAdvisorId, studentId: users[email].id } },
            update: {},
            create: { advisorId: eeAdvisorId, studentId: users[email].id },
        });
    }
    console.log('✅ Advisor assignments created');

    // ── 6. Student risk data profiles ────────────────────────────
    // Helper: create subjects, attendance, exams, marks, sessions, LMS, review items
    type StudentProfile = {
        email: string;
        subjects: string[];
        // attendance: [presentCount, totalCount] in last 30 days
        attendance: [number, number];
        consecutiveAbsences?: number;
        // marks: percentage per subject
        marks: number[];
        // studySessions: [{daysAgo, minutes}]
        studySessions: { daysAgo: number; minutes: number }[];
        // lmsActiveDays: day indices from today (0 = today, 1 = yesterday, etc.)
        lmsActiveDays: number[];
        // reviewItems: [weak, moderate, strong]
        reviewItems: [number, number, number];
    };

    const profiles: StudentProfile[] = [
        // RED 1 — Aryan Patel (student.red1)
        {
            email: 'student.red1@learnsphere.test',
            subjects: ['Data Structures', 'Algorithms'],
            attendance: [17, 29], // 58.6%
            consecutiveAbsences: 0,
            marks: [32, 28],
            studySessions: [{ daysAgo: 20, minutes: 45 }], // last session 20 days ago
            lmsActiveDays: [],                              // 0 LMS days
            reviewItems: [5, 0, 0],
        },
        // RED 2 — Kavitha Suresh (student.red2)
        {
            email: 'student.red2@learnsphere.test',
            subjects: ['DBMS', 'Operating Systems'],
            attendance: [18, 29], // 62.1%
            consecutiveAbsences: 3,
            marks: [38, 35],
            studySessions: [{ daysAgo: 18, minutes: 30 }],
            lmsActiveDays: [13],                           // 1 active day
            reviewItems: [4, 1, 0],
        },
        // AMBER 1 — Rohit Mehta (student.amber1)
        {
            email: 'student.amber1@learnsphere.test',
            subjects: ['Data Structures', 'Algorithms'],
            attendance: [23, 29], // 79.3%
            marks: [48, 52],
            studySessions: [
                { daysAgo: 10, minutes: 60 }, { daysAgo: 12, minutes: 45 },
                { daysAgo: 14, minutes: 30 }, { daysAgo: 16, minutes: 55 },
            ],
            lmsActiveDays: [3, 10],
            reviewItems: [2, 3, 1],
        },
        // AMBER 2 — Sneha Pillai (student.amber2)
        {
            email: 'student.amber2@learnsphere.test',
            subjects: ['DBMS', 'Operating Systems'],
            attendance: [24, 29], // 82.8%
            marks: [55, 44],
            // 8 sessions first 15 days, only 2 in last 15 → behavioural drop
            studySessions: [
                { daysAgo: 2, minutes: 30 }, { daysAgo: 8, minutes: 25 },
                { daysAgo: 16, minutes: 60 }, { daysAgo: 17, minutes: 55 }, { daysAgo: 18, minutes: 50 },
                { daysAgo: 19, minutes: 60 }, { daysAgo: 20, minutes: 45 }, { daysAgo: 21, minutes: 55 },
                { daysAgo: 22, minutes: 60 }, { daysAgo: 23, minutes: 50 },
            ],
            lmsActiveDays: [5, 12],
            reviewItems: [1, 4, 2],
        },
        // AMBER 3 — Dinesh Babu (student.amber3) — EE
        {
            email: 'student.amber3@learnsphere.test',
            subjects: ['Circuit Theory', 'Signals & Systems'],
            attendance: [21, 29], // 72.4%
            marks: [51, 53],
            studySessions: [
                { daysAgo: 8, minutes: 45 }, { daysAgo: 11, minutes: 30 },
                { daysAgo: 14, minutes: 50 }, { daysAgo: 18, minutes: 40 },
            ],
            lmsActiveDays: [2, 7, 12],
            reviewItems: [2, 2, 2],
        },
        // GREEN 1 — Ananya Raj (student.green1)
        {
            email: 'student.green1@learnsphere.test',
            subjects: ['Data Structures', 'Algorithms'],
            attendance: [27, 29], // 93.1%
            marks: [78, 82],
            studySessions: Array.from({ length: 16 }, (_, i) => ({ daysAgo: i * 2 + 1, minutes: 60 + (i % 3) * 15 })),
            lmsActiveDays: [1, 2, 3, 5, 7, 8, 9, 11, 13],
            reviewItems: [0, 2, 8],
        },
        // GREEN 2 — Vikram Singh (student.green2)
        {
            email: 'student.green2@learnsphere.test',
            subjects: ['Data Structures', 'Algorithms'],
            attendance: [28, 29], // 96.5%
            marks: [85, 88],
            studySessions: Array.from({ length: 18 }, (_, i) => ({ daysAgo: i + 1, minutes: 75 })),
            lmsActiveDays: [1, 2, 3, 4, 5, 8, 9, 10, 11, 13],
            reviewItems: [0, 1, 10],
        },
        // GREEN 3 — Preethi Nair (student.green3) — EE
        {
            email: 'student.green3@learnsphere.test',
            subjects: ['Circuit Theory', 'Signals & Systems'],
            attendance: [26, 29], // 89.6%
            marks: [75, 79],
            studySessions: Array.from({ length: 15 }, (_, i) => ({ daysAgo: i * 2 + 1, minutes: 60 })),
            lmsActiveDays: [1, 3, 5, 7, 9, 11, 13],
            reviewItems: [0, 2, 7],
        },
        // RECOVERED 1 — Keerthana Murthy (student.recovered1)
        {
            email: 'student.recovered1@learnsphere.test',
            subjects: ['Data Structures', 'Algorithms'],
            attendance: [26, 29], // now 89.6% (recovered)
            marks: [72, 68],
            studySessions: Array.from({ length: 14 }, (_, i) => ({ daysAgo: i + 1, minutes: 60 })),
            lmsActiveDays: [1, 3, 5, 7, 9, 11],
            reviewItems: [0, 3, 5],
        },
        // RECOVERED 2 — Samuel David (student.recovered2)
        {
            email: 'student.recovered2@learnsphere.test',
            subjects: ['DBMS', 'Operating Systems'],
            attendance: [25, 29], // 86.2%
            marks: [69, 73],
            studySessions: Array.from({ length: 12 }, (_, i) => ({ daysAgo: i + 1, minutes: 55 })),
            lmsActiveDays: [1, 2, 5, 8, 10],
            reviewItems: [0, 2, 6],
        },
    ];

    console.log('\n📊 Seeding student risk profiles...');
    for (const p of profiles) {
        const userId = users[p.email].id;

        // Create subjects for this student
        const subjectIds: string[] = [];
        for (const name of p.subjects) {
            const existing = await prisma.subject.findFirst({ where: { userId, name } });
            const subj = existing ?? await prisma.subject.create({ data: { userId, name } });
            subjectIds.push(subj.id);
        }

        // Attendance records — distribute across last 30 days
        const existingAtt = await prisma.attendanceRecord.findFirst({ where: { userId } });
        if (!existingAtt) {
            const [presentCount, totalCount] = p.attendance;
            const absentCount = totalCount - presentCount;
            const records: { userId: string; subjectId: string; date: Date; status: 'PRESENT' | 'ABSENT'; source: 'CSV_IMPORT' }[] = [];

            // If consecutive absences needed, put them at the end (most recent)
            let absentLeft = absentCount;
            const consecAbs = p.consecutiveAbsences ?? 0;
            const consecStart = totalCount - 1; // most recent day indices

            for (let i = 0; i < totalCount; i++) {
                const date = daysAgo(totalCount - i);
                const isConseqAbsent = (consecAbs > 0) && (i >= consecStart - consecAbs + 1);
                let status: 'PRESENT' | 'ABSENT' = 'PRESENT';
                if (isConseqAbsent && absentLeft > 0) {
                    status = 'ABSENT'; absentLeft--;
                } else if (!isConseqAbsent && absentLeft > 0 && (totalCount - i - 1) < absentLeft) {
                    status = 'ABSENT'; absentLeft--;
                }
                records.push({ userId, subjectId: subjectIds[0], date, status, source: 'CSV_IMPORT' });
            }
            await prisma.attendanceRecord.createMany({ data: records, skipDuplicates: true });
        }

        // Exams + marks
        const existingExam = await prisma.exam.findFirst({ where: { userId, title: 'Mid-Term Exam' } });
        if (!existingExam) {
            const exam = await prisma.exam.create({ data: { userId, title: 'Mid-Term Exam', examDate: daysAgo(20) } });
            const marks = subjectIds.map((sid, idx) => ({ examId: exam.id, subjectId: sid, marks: p.marks[idx] ?? 65 }));
            await prisma.examMark.createMany({ data: marks, skipDuplicates: true });
        }

        // Study sessions
        for (const sess of p.studySessions) {
            const existing = await prisma.studySession.findFirst({ where: { subjectId: subjectIds[0], startTime: { gte: daysAgo(sess.daysAgo + 1), lte: daysAgo(sess.daysAgo - 1) } } });
            if (!existing) {
                await prisma.studySession.create({ data: { subjectId: subjectIds[0], topic: 'Study session', activeMinutes: sess.minutes, startTime: daysAgo(sess.daysAgo) } });
            }
        }

        // LMS activity logs
        for (const dayIdx of p.lmsActiveDays) {
            const existingLms = await prisma.lMSActivityLog.findFirst({ where: { userId, loggedAt: { gte: daysAgo(dayIdx + 1), lte: daysAgo(dayIdx - 1) } } });
            if (!existingLms) {
                await prisma.lMSActivityLog.create({ data: { userId, source: 'MOODLE', activityType: 'login', loggedAt: daysAgo(dayIdx) } });
            }
        }

        // Review items
        const [weak, moderate, strong] = p.reviewItems;
        const existingReview = await prisma.reviewItem.findFirst({ where: { subjectId: subjectIds[0] } });
        if (!existingReview) {
            const reviewData = [
                ...Array(weak).fill({ subjectId: subjectIds[0], topic: 'Topic (Weak)', recallStrength: 'WEAK' as const }),
                ...Array(moderate).fill({ subjectId: subjectIds[0], topic: 'Topic (Moderate)', recallStrength: 'MODERATE' as const }),
                ...Array(strong).fill({ subjectId: subjectIds[0], topic: 'Topic (Strong)', recallStrength: 'STRONG' as const }),
            ].map((r, i) => ({ ...r, topic: r.topic + ` ${i + 1}` }));
            if (reviewData.length > 0) await prisma.reviewItem.createMany({ data: reviewData });
        }

        process.stdout.write(`  ✓ ${p.email.split('@')[0]}\n`);
    }

    // ── 7. Run risk calculations for all students ─────────────────
    console.log('\n🧠 Running risk calculations...');
    const studentEmails = profiles.map(p => p.email);
    const riskResults: Record<string, { score: number; level: string }> = {};
    for (const email of studentEmails) {
        const userId = users[email].id;
        try {
            const result = await calculateRisk(userId);
            riskResults[email] = { score: result.score, level: result.level };
            console.log(`  ${result.level.padEnd(5)} ${result.score.toString().padStart(5)} — ${email.split('@')[0]}`);
        } catch (e) {
            console.error(`  ERROR ${email}:`, (e as Error).message);
        }
    }

    // ── 8. Interventions ─────────────────────────────────────────
    console.log('\n📋 Creating interventions...');
    const priya = users['edu.priya@learnsphere.test'];
    const ravi = users['edu.ravi@learnsphere.test'];
    const red1 = users['student.red1@learnsphere.test'];
    const red2 = users['student.red2@learnsphere.test'];
    const amb1 = users['student.amber1@learnsphere.test'];
    const rec1 = users['student.recovered1@learnsphere.test'];
    const rec2 = users['student.recovered2@learnsphere.test'];

    // Get latest risk score IDs
    const getRisk = async (uid: string) => {
        const r = await prisma.riskScore.findFirst({ where: { userId: uid }, orderBy: { calculatedAt: 'desc' } });
        if (!r) throw new Error(`No risk score for ${uid}`);
        return r;
    };

    const red1Risk = await getRisk(red1.id);
    const red2Risk = await getRisk(red2.id);
    const amb1Risk = await getRisk(amb1.id);
    const rec1Risk = await getRisk(rec1.id);
    const rec2Risk = await getRisk(rec2.id);

    // Intervention A — RED1, PENDING_REVIEW
    const intA = await prisma.intervention.create({
        data: {
            studentId: red1.id, educatorId: priya.id, riskScoreId: red1Risk.id, status: 'PENDING_REVIEW',
            aiPlan: "Aryan's attendance has dropped to 58% and he is scoring below 35% in both subjects. Immediate action required: schedule weekly check-ins, provide remedial materials for Data Structures fundamentals, and contact parents.",
        }
    });
    console.log('  ✓ Intervention A (Aryan, PENDING_REVIEW)');

    // Intervention B — RED2, PENDING_REVIEW
    const intB = await prisma.intervention.create({
        data: {
            studentId: red2.id, educatorId: ravi.id, riskScoreId: red2Risk.id, status: 'PENDING_REVIEW',
            aiPlan: "Kavitha has missed 3 consecutive days and has not logged into LMS in over 14 days. Recommend immediate counsellor referral and subject-specific catch-up plan for DBMS.",
        }
    });
    console.log('  ✓ Intervention B (Kavitha, PENDING_REVIEW)');

    // Intervention C — AMB1, APPROVED + sent 5 days ago
    await prisma.intervention.create({
        data: {
            studentId: amb1.id, educatorId: priya.id, riskScoreId: amb1Risk.id, status: 'APPROVED',
            sentAt: daysAgo(5),
            aiPlan: "Rohit's study activity has dropped significantly and his exam marks are borderline. A structured study plan and regular check-ins are recommended.",
            finalPlan: "Rohit's study activity has dropped significantly and his exam marks are borderline. A structured study plan and regular check-ins are recommended.",
            educatorNote: "Spoke to Rohit briefly — he mentioned personal issues at home.",
        }
    });
    console.log('  ✓ Intervention C (Rohit, APPROVED)');

    // Interventions D & E — RECOVERED students, COMPLETED with outcomes
    for (const [student, risk, delta] of [[rec1, rec1Risk, -31], [rec2, rec2Risk, -32]] as const) {
        const intRec = await prisma.intervention.create({
            data: {
                studentId: student.id, educatorId: priya.id, riskScoreId: risk.id,
                status: 'COMPLETED', sentAt: daysAgo(30), seenAt: daysAgo(28),
                aiPlan: 'Structured remediation plan with weekly check-ins and study group participation.',
                finalPlan: 'Structured remediation plan with weekly check-ins and study group participation.',
            }
        });
        await prisma.interventionOutcome.create({
            data: {
                interventionId: intRec.id,
                followUpScore: risk.score + delta,
                deltaScore: delta,
                studentFeedback: 'The extra sessions and study plan helped a lot.',
                resolvedAt: daysAgo(10),
            }
        });
    }
    console.log('  ✓ Interventions D & E (Recovered students, COMPLETED with outcomes)');
    void intA; void intB;

    // ── 9. Counselling notes ─────────────────────────────────────
    console.log('\n📝 Creating counselling notes...');
    await prisma.counsellingNote.createMany({
        data: [
            {
                advisorId: csAdvisorId, studentId: red1.id,
                note: 'Initial meeting. Student seems disengaged. Agreed to weekly check-ins. Shared study schedule template.',
                sessionAt: daysAgo(7),
            },
            {
                advisorId: csAdvisorId, studentId: amb1.id,
                note: 'Follow-up meeting. Student opened up about family situation. Referred to college welfare officer.',
                sessionAt: daysAgo(4),
            },
        ]
    });
    console.log('  ✓ 2 counselling notes created');

    // ── 10. Summary ───────────────────────────────────────────────
    console.log('\n🎉 Seed complete!\n');
    console.log('Risk Score Summary:');
    for (const [email, r] of Object.entries(riskResults)) {
        const short = email.split('.test')[0].split('@')[0];
        console.log(`  [${r.level}] ${r.score.toString().padStart(5)} — ${short}`);
    }

    console.log('\nCredentials:');
    console.log('  admin@learnsphere.test        / Admin@123');
    console.log('  hod.cs@learnsphere.test       / Hod@12345');
    console.log('  hod.ee@learnsphere.test       / Hod@12345');
    console.log('  edu.priya@learnsphere.test    / Edu@12345');
    console.log('  edu.ravi@learnsphere.test     / Edu@12345');
    console.log('  advisor.cs@learnsphere.test   / Adv@12345');
    console.log('  advisor.ee@learnsphere.test   / Adv@12345');
    console.log('  student.red1@learnsphere.test / Student@123  (Aryan Patel - RED)');
    console.log('  student.green1@learnsphere.test / Student@123 (Ananya Raj - GREEN)');
    console.log('  parent.aryan@learnsphere.test / Parent@123');
    console.log('  parent.rohit@learnsphere.test / Parent@123');

    await prisma.$disconnect();
}

main().catch(err => {
    console.error('Seed failed:', err.message, err.stack?.slice(0, 500));
    process.exit(1);
});

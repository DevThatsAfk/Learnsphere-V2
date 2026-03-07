/**
 * fullSeed.ts — Seeds all 6 role accounts for local dev/testing.
 *
 * Run: node -e "require('./dist/seeds/fullSeed').seed()" 
 * Or via the npm script: npm run seed
 *
 * Safe to re-run — uses upsert throughout.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../prisma/client';

async function hash(pw: string) {
    return bcrypt.hash(pw, 10);
}

export async function seed() {
    console.log('🌱 LearnSphere full seed starting...\n');

    // ── Department ──────────────────────────────────────────────
    const dept = await prisma.department.upsert({
        where: { name: 'Computer Science' },
        update: {},
        create: { name: 'Computer Science' },
    });
    console.log(`✅ Department: ${dept.name}`);

    // ── Users ────────────────────────────────────────────────────
    const users = [
        { email: 'admin@learnsphere.demo', password: 'Admin123!', role: 'ADMIN' as const },
        { email: 'hod@learnsphere.demo', password: 'Hod12345!', role: 'HOD' as const },
        { email: 'educator@learnsphere.demo', password: 'Educator123!', role: 'EDUCATOR' as const },
        { email: 'advisor@learnsphere.demo', password: 'Advisor123!', role: 'ADVISOR' as const },
        { email: 'parent@learnsphere.demo', password: 'Parent123!', role: 'PARENT' as const },
        {
            email: 'student@learnsphere.demo',
            password: 'Student123!',
            role: 'STUDENT' as const,
            rollNumber: 'CS2024001',
            yearOfStudy: 2,
            section: 'A',
        },
    ];

    const created: Record<string, { id: string; email: string }> = {};

    for (const u of users) {
        const { email, password, role, ...profile } = u;
        const user = await prisma.user.upsert({
            where: { email },
            update: { role, passwordHash: await hash(password), departmentId: dept.id },
            create: {
                email,
                passwordHash: await hash(password),
                role,
                departmentId: dept.id,
                ...profile,
            },
        });
        created[role] = user;
        console.log(`✅ ${role.padEnd(8)} ${email}  /  ${password}`);
    }

    // ── Set HoD on department ────────────────────────────────────
    await prisma.department.update({
        where: { id: dept.id },
        data: { hodId: created['HOD'].id },
    });

    // ── Link parent → student ────────────────────────────────────
    await prisma.parentStudentLink.upsert({
        where: {
            parentId_studentId: {
                parentId: created['PARENT'].id,
                studentId: created['STUDENT'].id,
            },
        },
        update: {},
        create: {
            parentId: created['PARENT'].id,
            studentId: created['STUDENT'].id,
            relation: 'guardian',
            isPrimary: true,
        },
    });
    console.log(`✅ Parent → Student link created`);

    // ── Link advisor → student ───────────────────────────────────
    await prisma.advisorAssignment.upsert({
        where: {
            advisorId_studentId: {
                advisorId: created['ADVISOR'].id,
                studentId: created['STUDENT'].id,
            },
        },
        update: {},
        create: {
            advisorId: created['ADVISOR'].id,
            studentId: created['STUDENT'].id,
        },
    });
    console.log(`✅ Advisor → Student assignment created`);

    console.log('\n🎉 Seed complete! Login credentials:\n');
    console.log('  Role      │ Email                          │ Password');
    console.log('  ──────────┼────────────────────────────────┼─────────────');
    for (const u of users) {
        console.log(`  ${u.role.padEnd(9)} │ ${u.email.padEnd(30)}  │ ${u.password}`);
    }

    await prisma.$disconnect();
}

seed().catch(err => {
    console.error('Seed failed:', err.message);
    process.exit(1);
});

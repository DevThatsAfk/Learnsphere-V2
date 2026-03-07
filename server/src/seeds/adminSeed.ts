/**
 * adminSeed.ts — Creates first ADMIN account + sample department.
 *
 * Run: npx ts-node -e "import('./src/seeds/adminSeed').then(m => m.seed())"
 * Or:  npx tsx src/seeds/adminSeed.ts
 *
 * Only runs if ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD are set in .env.
 * Safe to re-run — uses upsert for the admin user.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../prisma/client';

export async function seed() {
    const email = process.env.ADMIN_SEED_EMAIL;
    const password = process.env.ADMIN_SEED_PASSWORD;

    if (!email || !password) {
        console.error('❌ Set ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD in .env first.');
        process.exit(1);
    }

    console.log('🌱 Seeding admin account...');

    // 1. Create default department
    const dept = await prisma.department.upsert({
        where: { name: 'Computer Science' },
        update: {},
        create: { name: 'Computer Science' },
    });
    console.log(`✅ Department: ${dept.name} (${dept.id})`);

    // 2. Create admin user
    const passwordHash = await bcrypt.hash(password, 12);
    const admin = await prisma.user.upsert({
        where: { email },
        update: { role: 'ADMIN', passwordHash },
        create: {
            email,
            passwordHash,
            role: 'ADMIN',
            departmentId: dept.id,
        },
    });
    console.log(`✅ Admin user: ${admin.email} (${admin.id})`);

    // 3. Set admin as HoD of the department (demonstrates the HOD role flow)
    await prisma.department.update({
        where: { id: dept.id },
        data: { hodId: admin.id },
    });

    // 4. Sample STUDENT for testing
    const studentEmail = 'student@learnsphere.demo';
    const student = await prisma.user.upsert({
        where: { email: studentEmail },
        update: {},
        create: {
            email: studentEmail,
            passwordHash: await bcrypt.hash('student123', 12),
            role: 'STUDENT',
            departmentId: dept.id,
            rollNumber: 'CS2024001',
            yearOfStudy: 2,
            section: 'A',
        },
    });
    console.log(`✅ Demo student: ${student.email} (${student.id})`);

    // 5. Sample EDUCATOR
    const educatorEmail = 'educator@learnsphere.demo';
    const educator = await prisma.user.upsert({
        where: { email: educatorEmail },
        update: {},
        create: {
            email: educatorEmail,
            passwordHash: await bcrypt.hash('educator123', 12),
            role: 'EDUCATOR',
            departmentId: dept.id,
        },
    });
    console.log(`✅ Demo educator: ${educator.email} (${educator.id})`);

    console.log('\n🎉 Seed complete. Credentials:');
    console.log(`   Admin:    ${email} / ${password}`);
    console.log(`   Student:  ${studentEmail} / student123`);
    console.log(`   Educator: ${educatorEmail} / educator123`);

    await prisma.$disconnect();
}

// Allow direct execution
seed().catch(err => {
    console.error(err);
    process.exit(1);
});

/**
 * routes/admin.ts — Admin portal endpoints.
 */
import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roleGuard';
import { asyncHandler, ApiError } from '../middleware/errorHandler';
import { upload } from '../middleware/upload';
import { prisma } from '../prisma/client';
import bcrypt from 'bcryptjs';

/** Write an admin audit entry */
async function audit(adminId: string, action: string, target?: string, metadata?: object) {
    await prisma.auditLog.create({ data: { userId: adminId, action, target, metadata: metadata ?? {} } }).catch(() => { });
}


const router = Router();
router.use(authenticateToken);
router.use(requireRole(['ADMIN']));

/** GET /api/admin/users */
router.get('/users', asyncHandler(async (req, res) => {
    const page = parseInt(String(req.query.page ?? '1'));
    const limit = 20;
    const [users, total] = await Promise.all([
        prisma.user.findMany({
            skip: (page - 1) * limit, take: limit,
            orderBy: { createdAt: 'desc' },
            select: { id: true, email: true, role: true, departmentId: true, rollNumber: true, yearOfStudy: true, createdAt: true },
        }),
        prisma.user.count(),
    ]);
    res.json({ users, total, page, totalPages: Math.ceil(total / limit) });
}));

/** POST /api/admin/users */
router.post('/users', asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { email, password, role, departmentId, rollNumber, yearOfStudy, section } = req.body;
    if (!email || !password || !role) throw new ApiError(400, 'email, password, and role are required.', 'MISSING_FIELDS');

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
        data: { email, passwordHash, role, departmentId, rollNumber, yearOfStudy, section },
    });
    await audit(req.userId!, 'user.create', user.id, { email, role });
    res.status(201).json({ id: user.id, email: user.email, role: user.role });
}));

/** PATCH /api/admin/users/:id */
router.patch('/users/:id', asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    const safeId = String(id);
    const { role, departmentId, rollNumber, yearOfStudy, section } = req.body;
    const updated = await prisma.user.update({
        where: { id: safeId },
        data: { role, departmentId, rollNumber, yearOfStudy, section },
    });
    await audit(req.userId!, 'user.update', safeId, { role, departmentId });
    res.json({ id: updated.id, email: updated.email, role: updated.role });
}));

/** DELETE /api/admin/users/:id */
router.delete('/users/:id', asyncHandler(async (req: AuthenticatedRequest, res) => {
    const safeId = String(req.params.id);
    await prisma.user.delete({ where: { id: safeId } });
    await audit(req.userId!, 'user.delete', safeId);
    res.json({ message: 'User deleted.' });
}));

/** POST /api/admin/users/bulk-import — CSV bulk import */
router.post('/users/bulk-import', upload.single('file'), asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.file) throw new ApiError(400, 'CSV file required.', 'MISSING_FILE');

    const text = req.file.buffer.toString('utf-8');
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) throw new ApiError(400, 'CSV must have a header row and at least one data row.', 'EMPTY_CSV');

    // Parse header
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z]/g, ''));
    const getCol = (row: string[], key: string) => {
        const idx = headers.indexOf(key);
        return idx >= 0 ? row[idx]?.trim() ?? '' : '';
    };

    const results: { row: number; email: string; status: string; reason?: string }[] = [];
    let imported = 0; let skipped = 0; let failed = 0;

    // Pre-load all departments for name lookup
    const deptList = await prisma.department.findMany({ select: { id: true, name: true } });
    const deptByName = new Map(deptList.map(d => [d.name.toLowerCase(), d.id]));

    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        const email = getCol(cols, 'email');
        const password = getCol(cols, 'password');
        const roleRaw = getCol(cols, 'role').toUpperCase();
        const deptName = getCol(cols, 'department').toLowerCase();
        const rollNumber = getCol(cols, 'rollnumber') || getCol(cols, 'roll') || undefined;
        const yearOfStudy = parseInt(getCol(cols, 'yearofstudy') || getCol(cols, 'year') || '0') || undefined;
        const section = getCol(cols, 'section') || undefined;

        if (!email || !password) { results.push({ row: i + 1, email: email || '(blank)', status: 'FAILED', reason: 'Missing email or password' }); failed++; continue; }
        const validRoles = ['STUDENT', 'PARENT', 'EDUCATOR', 'ADVISOR', 'HOD', 'ADMIN'];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const role = (validRoles.includes(roleRaw) ? roleRaw : 'STUDENT') as any;
        const departmentId = deptName ? (deptByName.get(deptName) ?? undefined) : undefined;

        try {
            // Skip if already exists
            const existing = await prisma.user.findUnique({ where: { email } });
            if (existing) { results.push({ row: i + 1, email, status: 'SKIPPED', reason: 'Email already exists' }); skipped++; continue; }
            const passwordHash = await bcrypt.hash(password, 10);
            const user = await prisma.user.create({ data: { email, passwordHash, role, departmentId, rollNumber, yearOfStudy, section } });
            await audit(req.userId!, 'user.bulkImport', user.id, { email, role });
            results.push({ row: i + 1, email, status: 'IMPORTED' }); imported++;
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Unknown error';
            results.push({ row: i + 1, email, status: 'FAILED', reason: msg }); failed++;
        }
    }

    res.json({ summary: { imported, skipped, failed, total: lines.length - 1 }, results });
}));

/** POST /api/admin/assign/advisor */
router.post('/assign/advisor', asyncHandler(async (req, res) => {
    const { advisorId, studentId } = req.body;
    const assignment = await prisma.advisorAssignment.upsert({
        where: { advisorId_studentId: { advisorId, studentId } },
        update: {},
        create: { advisorId, studentId },
    });
    res.status(201).json(assignment);
}));

/** POST /api/admin/assign/parent */
router.post('/assign/parent', asyncHandler(async (req, res) => {
    const { parentId, studentId, relation, isPrimary } = req.body;
    const link = await prisma.parentStudentLink.upsert({
        where: { parentId_studentId: { parentId, studentId } },
        update: {},
        create: { parentId, studentId, relation: relation ?? 'guardian', isPrimary: isPrimary ?? false },
    });
    res.status(201).json(link);
}));

/** GET /api/admin/departments */
router.get('/departments', asyncHandler(async (_req, res) => {
    const depts = await prisma.department.findMany({
        include: { hod: { select: { id: true, email: true } } },
    });
    res.json(depts);
}));

/** POST /api/admin/departments */
router.post('/departments', asyncHandler(async (req, res) => {
    const { name } = req.body;
    if (!name) throw new ApiError(400, 'name is required.', 'MISSING_FIELDS');
    const dept = await prisma.department.create({ data: { name } });
    res.status(201).json(dept);
}));

/** PATCH /api/admin/departments/:id/hod */
router.patch('/departments/:id/hod', asyncHandler(async (req, res) => {
    const deptId = String(req.params.id);
    const { hodId } = req.body;
    const dept = await prisma.department.update({ where: { id: deptId }, data: { hodId } });
    res.json(dept);
}));

/** PATCH /api/admin/thresholds — institution-wide */
router.patch('/thresholds', asyncHandler(async (req, res) => {
    const { attendanceMin, marksMin, neglectDays, lmsLoginsMin } = req.body;
    const config = await prisma.riskThresholdConfig.upsert({
        where: { departmentId: undefined },
        update: { attendanceMin, marksMin, neglectDays, lmsLoginsMin },
        create: { attendanceMin, marksMin, neglectDays, lmsLoginsMin },
    });
    res.json(config);
}));

/** GET /api/admin/audit-logs */
router.get('/audit-logs', asyncHandler(async (req, res) => {
    const page = parseInt(String(req.query.page ?? '1'));
    const limit = 50;
    const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
            skip: (page - 1) * limit, take: limit,
            orderBy: { createdAt: 'desc' },
            include: { user: { select: { id: true, email: true } } },
        }),
        prisma.auditLog.count(),
    ]);
    res.json({ logs, total, page, totalPages: Math.ceil(total / limit) });
}));

/** GET /api/admin/system/health */
router.get('/system/health', asyncHandler(async (_req, res) => {
    const [totalUsers, redRiskCount, pendingInterventions] = await Promise.all([
        prisma.user.count(),
        prisma.riskScore.count({ where: { level: 'RED' } }),
        prisma.intervention.count({ where: { status: 'PENDING_REVIEW' } }),
    ]);
    const snapshot = { totalUsers, redRiskCount, pendingInterventions, checkedAt: new Date() };
    res.json(snapshot);
}));

/** GET /api/admin/lms/integrations */
router.get('/lms/integrations', asyncHandler(async (_req, res) => {
    const integrations = await prisma.lMSIntegration.findMany({ where: { isActive: true } });
    res.json(integrations);
}));

/** POST /api/admin/lms/integrations */
router.post('/lms/integrations', asyncHandler(async (req, res) => {
    const { institutionId, source, config } = req.body;
    const integration = await prisma.lMSIntegration.create({
        data: { institutionId, source, config },
    });
    res.status(201).json(integration);
}));

export default router;

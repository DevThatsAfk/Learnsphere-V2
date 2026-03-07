/**
 * lmsService.ts — Phase 4: LMS data ingestion.
 *
 * Parses CSV for attendance and LMS activity.
 * Expected CSV columns:
 *
 * Attendance CSV:
 *   studentRoll, subjectName, date (YYYY-MM-DD), status (PRESENT|ABSENT|LATE|EXCUSED)
 *
 * LMS Activity CSV:
 *   studentRoll, activityType, durationMins, loggedAt (ISO 8601), source (MOODLE|GOOGLE_CLASSROOM|CSV_IMPORT)
 */
import { parse as csvParse } from 'csv-parse/sync';
import { prisma } from '../prisma/client';
import type { AttendanceStatus, LMSSource } from '@prisma/client';

interface AttendanceRow {
    studentRoll: string;
    subjectName: string;
    date: string;
    status: string;
}

interface ActivityRow {
    studentRoll: string;
    activityType: string;
    durationMins: string;
    loggedAt: string;
    source: string;
}

export interface ImportResult {
    imported: number;
    skipped: number;
    errors: string[];
}

/**
 * Import attendance from CSV buffer.
 */
export async function importAttendanceCSV(buffer: Buffer, batchId: string): Promise<ImportResult> {
    const rows: AttendanceRow[] = csvParse(buffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
    });

    const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

    for (const row of rows) {
        try {
            // Resolve student by rollNumber
            const student = await prisma.user.findFirst({
                where: { rollNumber: row.studentRoll },
                select: { id: true },
            });
            if (!student) {
                result.skipped++;
                result.errors.push(`Row skipped: no student with rollNumber=${row.studentRoll}`);
                continue;
            }

            // Resolve subject by name (best-effort match within student's subjects)
            const subject = await prisma.subject.findFirst({
                where: { userId: student.id, name: { equals: row.subjectName, mode: 'insensitive' } },
                select: { id: true },
            });
            if (!subject) {
                result.skipped++;
                result.errors.push(`Row skipped: subject "${row.subjectName}" not found for ${row.studentRoll}`);
                continue;
            }

            const validStatuses: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];
            const status = row.status.toUpperCase() as AttendanceStatus;
            if (!validStatuses.includes(status)) {
                result.errors.push(`Invalid status "${row.status}" for ${row.studentRoll} — defaulting to ABSENT`);
            }

            await prisma.attendanceRecord.upsert({
                where: {
                    userId_subjectId_date: {
                        userId: student.id,
                        subjectId: subject.id,
                        date: new Date(row.date),
                    },
                },
                update: { status: validStatuses.includes(status) ? status : 'ABSENT', importBatch: batchId },
                create: {
                    userId: student.id,
                    subjectId: subject.id,
                    date: new Date(row.date),
                    status: validStatuses.includes(status) ? status : 'ABSENT',
                    source: 'CSV_IMPORT',
                    importBatch: batchId,
                },
            });
            result.imported++;
        } catch (err) {
            result.errors.push(`Error on row (${row.studentRoll}): ${err instanceof Error ? err.message : 'unknown'}`);
        }
    }

    console.log(`[LMS Import] Attendance batch ${batchId}: ${result.imported} imported, ${result.skipped} skipped`);
    return result;
}

/**
 * Import LMS activity from CSV buffer.
 */
export async function importActivityCSV(buffer: Buffer, batchId: string): Promise<ImportResult> {
    const rows: ActivityRow[] = csvParse(buffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
    });

    const result: ImportResult = { imported: 0, skipped: 0, errors: [] };
    const validSources: LMSSource[] = ['MOODLE', 'GOOGLE_CLASSROOM', 'CSV_IMPORT'];

    for (const row of rows) {
        try {
            const student = await prisma.user.findFirst({
                where: { rollNumber: row.studentRoll },
                select: { id: true },
            });
            if (!student) {
                result.skipped++;
                result.errors.push(`Row skipped: no student with rollNumber=${row.studentRoll}`);
                continue;
            }

            const source = row.source?.toUpperCase() as LMSSource;

            await prisma.lMSActivityLog.create({
                data: {
                    userId: student.id,
                    source: validSources.includes(source) ? source : 'CSV_IMPORT',
                    activityType: row.activityType ?? 'login',
                    durationMins: row.durationMins ? parseInt(row.durationMins) : null,
                    loggedAt: row.loggedAt ? new Date(row.loggedAt) : new Date(),
                    metadata: { importBatch: batchId },
                },
            });
            result.imported++;
        } catch (err) {
            result.errors.push(`Error on row (${row.studentRoll}): ${err instanceof Error ? err.message : 'unknown'}`);
        }
    }

    console.log(`[LMS Import] Activity batch ${batchId}: ${result.imported} imported, ${result.skipped} skipped`);
    return result;
}

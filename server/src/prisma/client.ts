/**
 * prisma/client.ts
 *
 * Prisma singleton using @prisma/adapter-pg driver adapter.
 * This avoids the native Windows engine binary (.dll.node) that fails
 * to load due to missing VC++ redistributable on some Windows machines.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const { Pool } = pg;

// Parse DATABASE_URL from .env
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required.');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

// Singleton pattern — prevents multiple instances in development (hot reload)
const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}

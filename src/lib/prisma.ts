import { PrismaClient } from '@prisma/client';
import { env } from './env';

void env.DATABASE_URL;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: [],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

import { PrismaClient } from '@prisma/client';
import { env } from '../../constants/environment';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export function getPrismaClient() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      datasources: {
        db: {
          url: env.DATABASE_URL,
        },
      },
      transactionOptions: {
        maxWait: 60 * 1000, // 1 minute
        timeout: 60 * 1000, // 1 minute
      },
    });
  }

  return globalForPrisma.prisma;
}

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

if (!env.databaseUrl) {
  console.warn("DATABASE_URL is not set. Database-backed routes will fail until it is configured.");
}

const adapter = new PrismaPg({ connectionString: env.databaseUrl || "postgresql://postgres:postgres@localhost:5432/github_changes" });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

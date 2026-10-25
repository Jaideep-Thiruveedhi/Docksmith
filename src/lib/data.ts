import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";

export async function readWorkspace<T>(
  load: (db: PrismaClient) => Promise<T>,
): Promise<{ data: T | null; error: string | null }> {
  try {
    if (!getEnv().DATABASE_URL)
      return {
        data: null,
        error:
          "Connect your Neon database to get started. Copy .env.local.example to .env.local, set DATABASE_URL, and run npx prisma db push.",
      };
    return { data: await load(getPrisma()), error: null };
  } catch (error) {
    const message =
      error instanceof Error &&
      error.message.startsWith("Invalid environment configuration:")
        ? error.message
        : "The database is unavailable or the schema is missing. Check DATABASE_URL and run npx prisma db push.";
    return { data: null, error: message };
  }
}

export const repoSelect = {
  id: true,
  owner: true,
  name: true,
  trackedBranch: true,
} as const;

export function syncIsActive(repo: {
  status: string;
  syncStartedAt: Date | null;
}): boolean {
  return (
    repo.status === "SYNCING" &&
    Boolean(
      repo.syncStartedAt && Date.now() - repo.syncStartedAt.getTime() < 600_000,
    )
  );
}

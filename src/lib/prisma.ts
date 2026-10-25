import "server-only";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma/client";
import { requireEnv } from "@/lib/env";

const globalForPrisma = globalThis as unknown as {
  docsmithPrisma?: PrismaClient;
};
let client: PrismaClient | undefined;

/** Lazily create one client, so an unconfigured installation can still render setup. */
export function getPrisma(): PrismaClient {
  if (client) return client;
  if (globalForPrisma.docsmithPrisma)
    return (client = globalForPrisma.docsmithPrisma);

  const env = requireEnv("DATABASE_URL");
  client = new PrismaClient({
    adapter: new PrismaNeon({ connectionString: env.DATABASE_URL }),
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
  if (env.NODE_ENV !== "production") globalForPrisma.docsmithPrisma = client;
  return client;
}

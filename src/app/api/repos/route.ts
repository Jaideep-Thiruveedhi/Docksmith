import { api } from "@/lib/api";
import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";
export async function GET() {
  return api(async () => ({
    repositories: await getPrisma().repository.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  }));
}

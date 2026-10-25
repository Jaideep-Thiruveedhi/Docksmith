import { z } from "zod";
import { api, idSchema } from "@/lib/api";
import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";
export async function GET(request: Request) {
  return api(async () => {
    const input = z
      .object({ repoId: idSchema.optional() })
      .parse(Object.fromEntries(new URL(request.url).searchParams));
    const db = getPrisma();
    const [commits, flags] = await Promise.all([
      db.commit.findMany({
        where: { repoId: input.repoId },
        orderBy: { date: "desc" },
        take: 50,
        include: { repo: { select: { owner: true, name: true } } },
      }),
      db.stalenessFlag.findMany({
        where: {
          status: { not: "OK" },
          codeUnit: { file: { repoId: input.repoId } },
        },
        include: { codeUnit: { include: { file: true } } },
        orderBy: { updatedAt: "desc" },
        take: 100,
      }),
    ]);
    return { commits, flags };
  });
}

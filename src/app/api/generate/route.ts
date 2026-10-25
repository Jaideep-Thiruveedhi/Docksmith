import { z } from "zod";
import { api, idSchema, readJson } from "@/lib/api";
import {
  generateDocumentation,
  generateRepositoryDocumentation,
} from "@/lib/documentation";

export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: Request) {
  return api(async () => {
    const input = await readJson(
      request,
      z.union([
        z.object({
          repoId: idSchema,
          limit: z.number().int().min(1).max(10).default(3),
        }),
        z.object({ codeUnitId: idSchema }),
      ]),
    );
    return "repoId" in input
      ? generateRepositoryDocumentation(input.repoId, input.limit)
      : generateDocumentation(input.codeUnitId);
  });
}

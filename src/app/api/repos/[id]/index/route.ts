import { z } from "zod";
import { api, idSchema, readJson } from "@/lib/api";
import { reindexRepository } from "@/lib/documentation";

export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    const input = await readJson(
      request,
      z.object({ cursor: idSchema.optional() }),
    );
    return reindexRepository(
      idSchema.parse((await context.params).id),
      input.cursor,
    );
  });
}

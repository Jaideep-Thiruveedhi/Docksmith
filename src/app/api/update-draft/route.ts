import { z } from "zod";
import { api, idSchema, readJson } from "@/lib/api";
import { generateDocumentation } from "@/lib/documentation";

export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: Request) {
  return api(async () => {
    const input = await readJson(request, z.object({ codeUnitId: idSchema }));
    return generateDocumentation(input.codeUnitId, true);
  });
}

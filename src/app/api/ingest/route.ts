import { api, readJson } from "@/lib/api";
import { ingestSchema } from "@/lib/github";
import { ingestRepository } from "@/lib/repositories";

export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: Request) {
  return api(async () => {
    const input = await readJson(request, ingestSchema);
    return ingestRepository(input.repoUrl, input.branch);
  });
}

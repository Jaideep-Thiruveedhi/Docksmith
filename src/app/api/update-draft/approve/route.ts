import { z } from "zod";
import { api, idSchema, readJson } from "@/lib/api";
import { approveDraft } from "@/lib/documentation";

export const runtime = "nodejs";
export async function POST(request: Request) {
  return api(async () =>
    approveDraft(
      (await readJson(request, z.object({ documentId: idSchema }))).documentId,
    ),
  );
}

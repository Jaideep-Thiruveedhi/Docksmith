import { z } from "zod";
import { api, idSchema, readJson } from "@/lib/api";
import { rejectDraft } from "@/lib/documentation";

export const runtime = "nodejs";
export async function POST(request: Request) {
  return api(async () =>
    rejectDraft(
      (await readJson(request, z.object({ documentId: idSchema }))).documentId,
    ),
  );
}

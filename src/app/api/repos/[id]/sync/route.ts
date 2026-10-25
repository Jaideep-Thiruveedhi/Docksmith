import { api, idSchema } from "@/lib/api";
import { syncRepository } from "@/lib/repositories";

export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return api(async () =>
    syncRepository(idSchema.parse((await context.params).id)),
  );
}

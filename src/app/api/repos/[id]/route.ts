import { api, idSchema } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { getPrisma } from "@/lib/prisma";
import { deleteRepository } from "@/lib/repositories";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  return api(async () => {
    const id = idSchema.parse((await context.params).id);
    const repo = await getPrisma().repository.findUnique({
      where: { id },
      include: {
        _count: { select: { files: true, commits: true, chatSessions: true } },
      },
    });
    if (!repo) throw new AppError("Repository not found.", 404);
    return repo;
  });
}
export async function DELETE(_request: Request, context: Context) {
  return api(async () =>
    deleteRepository(idSchema.parse((await context.params).id)),
  );
}

import { idSchema } from "@/lib/api";
import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const id = idSchema.safeParse((await context.params).id);
  if (!id.success)
    return Response.json({ error: "Invalid document ID." }, { status: 400 });
  try {
    const doc = await getPrisma().documentation.findUnique({
      where: { id: id.data },
      include: { codeUnit: { select: { name: true } } },
    });
    if (!doc)
      return Response.json({ error: "Document not found." }, { status: 404 });
    const name = doc.codeUnit.name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
    return new Response(doc.markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}-v${doc.version}.md"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json(
      { error: "Document download failed. Check database configuration." },
      { status: 503 },
    );
  }
}

import { api } from "@/lib/api";
import { requireEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { getPrisma } from "@/lib/prisma";
import { syncRepository } from "@/lib/repositories";
import { pushSchema, verifyWebhookSignature } from "@/lib/webhook";

export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: Request) {
  return api(async () => {
    const env = requireEnv("GITHUB_WEBHOOK_SECRET");
    const body = await request.text();
    if (Buffer.byteLength(body) > 2_000_000)
      throw new AppError("Webhook is too large.", 413);
    if (
      !verifyWebhookSignature(
        body,
        request.headers.get("x-hub-signature-256"),
        env.GITHUB_WEBHOOK_SECRET,
      )
    )
      throw new AppError("Invalid webhook signature.", 401);
    const event = request.headers.get("x-github-event");
    if (event === "ping") return { received: true };
    if (event !== "push") return { ignored: true };
    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch {
      throw new AppError("Invalid webhook JSON.");
    }
    const push = pushSchema.parse(payload);
    if (push.deleted || !push.ref.startsWith("refs/heads/"))
      return { ignored: true };
    const repos = await getPrisma().repository.findMany({
      where: {
        owner: push.repository.owner.login.toLowerCase(),
        name: push.repository.name.toLowerCase(),
        trackedBranch: push.ref.slice("refs/heads/".length),
      },
    });
    for (const repo of repos) await syncRepository(repo.id);
    return { received: true, synced: repos.length };
  });
}

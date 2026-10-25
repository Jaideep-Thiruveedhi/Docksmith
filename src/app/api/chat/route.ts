import { z } from "zod";
import { api, idSchema, readJson } from "@/lib/api";
import { chatInputSchema, getChatHistory, sendChatMessage } from "@/lib/chat";

export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: Request) {
  return api(async () =>
    sendChatMessage(await readJson(request, chatInputSchema)),
  );
}
export async function GET(request: Request) {
  return api(async () => {
    const input = z
      .object({ repoId: idSchema, sessionId: idSchema.optional() })
      .parse(Object.fromEntries(new URL(request.url).searchParams));
    return getChatHistory(input.repoId, input.sessionId);
  });
}

import "server-only";
import { z } from "zod";
import { requireEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function chatCompletion(messages: LlmMessage[]): Promise<string> {
  const env = requireEnv("LLM_API_KEY", "LLM_BASE_URL", "LLM_MODEL");
  let response: Response;
  try {
    response = await fetch(
      `${env.LLM_BASE_URL.replace(/\/+$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.LLM_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: env.LLM_MODEL,
          messages,
          temperature: 0.2,
        }),
        signal: AbortSignal.timeout(120_000),
      },
    );
  } catch {
    throw new AppError(
      "Could not reach the LLM provider, or the request timed out. Check LLM_BASE_URL and retry.",
      502,
    );
  }
  if (!response.ok)
    throw new AppError(
      `The LLM provider returned HTTP ${response.status}. Check your model, API key, and base URL.`,
      502,
    );
  const result = z
    .object({
      choices: z.array(
        z.object({ message: z.object({ content: z.string().nullable() }) }),
      ),
    })
    .safeParse(await response.json());
  const text = result.success
    ? result.data.choices[0]?.message.content?.trim()
    : undefined;
  if (!text)
    throw new AppError(
      "The LLM provider returned an empty or unsupported response.",
      502,
    );
  return text;
}

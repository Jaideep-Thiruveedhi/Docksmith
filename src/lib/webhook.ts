import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export function verifyWebhookSignature(
  body: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(body).digest();
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), "hex"));
}

export const pushSchema = z.object({
  ref: z.string(),
  deleted: z.boolean().optional(),
  repository: z.object({
    name: z.string(),
    owner: z.object({ login: z.string() }),
  }),
});

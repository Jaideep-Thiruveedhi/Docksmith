import { z } from "zod";

export const sourceSchema = z.object({
  documentId: z.string(),
  codeUnitId: z.string(),
  filePath: z.string(),
  name: z.string(),
  startLine: z.number().int(),
  endLine: z.number().int(),
  score: z.number(),
  status: z.enum([
    "OK",
    "REVIEW_RECOMMENDED",
    "POTENTIALLY_OUTDATED",
    "BROKEN",
  ]),
});
export type ChatSource = z.infer<typeof sourceSchema>;

export interface ChatMessageView {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  sources: ChatSource[];
}

export interface SessionView {
  id: string;
  title: string;
  updatedAt: string;
}

import { z } from "zod";

export const filtersSchema = z.object({
  repoId: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().cuid().optional(),
  ),
  q: z.string().trim().max(200).optional(),
  status: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z
      .enum(["OK", "REVIEW_RECOMMENDED", "POTENTIALLY_OUTDATED", "BROKEN"])
      .optional(),
  ),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
export type SearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

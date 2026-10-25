import "server-only";
import { z } from "zod";
import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";

export function parseGitHubUrl(
  value: string,
): { owner: string; name: string } | null {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "github.com" ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return null;
    const match = url.pathname.match(
      /^\/([a-zA-Z0-9-]+)\/([a-zA-Z0-9_.-]+)\/?$/,
    );
    if (!match) return null;
    const name = match[2].replace(/\.git$/, "");
    if (!name || name === "." || name === "..") return null;
    return { owner: match[1].toLowerCase(), name: name.toLowerCase() };
  } catch {
    return null;
  }
}

export const ingestSchema = z.object({
  repoUrl: z
    .string()
    .trim()
    .max(500)
    .refine(
      (value) => parseGitHubUrl(value) !== null,
      "Use https://github.com/owner/repository",
    ),
  branch: z.string().trim().min(1).max(200).optional(),
});

async function github<T extends z.ZodType>(
  path: string,
  schema: T,
): Promise<z.output<T>> {
  const token = getEnv().GITHUB_TOKEN;
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Docsmith",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    if (response.status === 404)
      throw new AppError(
        "GitHub repository, branch, or commit was not found. Check the URL and token access.",
        404,
      );
    if (response.status === 403 || response.status === 429)
      throw new AppError(
        "GitHub denied the request or its rate limit was reached. Check GITHUB_TOKEN and retry later.",
        429,
      );
    throw new AppError(`GitHub request failed (${response.status}).`, 502);
  }
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success)
    throw new AppError("GitHub returned an unexpected response.", 502);
  return parsed.data;
}

const commitSchema = z.object({
  sha: z.string(),
  commit: z.object({
    message: z.string(),
    author: z
      .object({ name: z.string().nullable(), date: z.string() })
      .nullable(),
    committer: z
      .object({ name: z.string().nullable(), date: z.string() })
      .nullable(),
    tree: z.object({ sha: z.string() }),
  }),
});
export type GitHubCommit = z.infer<typeof commitSchema>;

export interface SourceFile {
  path: string;
  sha: string;
  size: number;
}

const extensions = new Set([
  "js",
  "jsx",
  "ts",
  "tsx",
  "mjs",
  "cjs",
  "mts",
  "cts",
  "py",
]);
const ignored = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "coverage",
  "vendor",
  ".venv",
  "venv",
  "__pycache__",
  "generated",
]);

export function isSourceFile(path: string): boolean {
  return (
    !path.split("/").some((segment) => ignored.has(segment)) &&
    !path.endsWith(".d.ts") &&
    !path.endsWith(".min.js") &&
    extensions.has(path.split(".").pop()?.toLowerCase() ?? "")
  );
}

export async function getRepository(owner: string, name: string) {
  return github(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`,
    z.object({ default_branch: z.string() }),
  );
}

export async function getSnapshot(owner: string, name: string, branch: string) {
  const prefix = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
  const head = await github(
    `${prefix}/commits/${encodeURIComponent(branch)}`,
    commitSchema,
  );
  const tree = await github(
    `${prefix}/git/trees/${head.commit.tree.sha}?recursive=1`,
    z.object({
      truncated: z.boolean(),
      tree: z.array(
        z.object({
          path: z.string(),
          type: z.string(),
          sha: z.string(),
          size: z.number().optional(),
        }),
      ),
    }),
  );
  if (tree.truncated)
    throw new AppError(
      "GitHub truncated this repository's file tree. Use a smaller repository to avoid incomplete ingestion.",
      422,
    );
  const files: SourceFile[] = tree.tree
    .filter((entry) => entry.type === "blob" && isSourceFile(entry.path))
    .map((entry) => ({ ...entry, size: entry.size ?? 0 }));
  if (files.length > 1000)
    throw new AppError(
      "This workspace supports up to 1,000 source files per repository.",
      422,
    );
  if (files.some((file) => file.size > 1_000_000))
    throw new AppError("A source file exceeds the 1 MB parsing limit.", 422);
  if (files.reduce((total, file) => total + file.size, 0) > 20_000_000)
    throw new AppError("Source files exceed the 20 MB repository limit.", 422);
  return { head, files };
}

export async function getBlob(
  owner: string,
  name: string,
  sha: string,
): Promise<string> {
  const blob = await github(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/git/blobs/${sha}`,
    z.object({ content: z.string(), encoding: z.string(), size: z.number() }),
  );
  if (blob.size > 1_000_000 || blob.encoding !== "base64")
    throw new AppError("GitHub returned an unsupported source blob.", 422);
  const bytes = Buffer.from(blob.content, "base64");
  if (bytes.includes(0))
    throw new AppError("A source file contains binary data.", 422);
  return bytes.toString("utf8");
}

export async function getNewCommits(
  owner: string,
  name: string,
  base: string | null,
  head: GitHubCommit,
): Promise<GitHubCommit[]> {
  if (!base || base === head.sha) return base === head.sha ? [] : [head];
  const commits: GitHubCommit[] = [];
  for (let page = 1; page <= 10; page++) {
    try {
      const result = await github(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/compare/${base}...${head.sha}?per_page=100&page=${page}`,
        z.object({ commits: z.array(commitSchema), total_commits: z.number() }),
      );
      if (result.total_commits > 1000)
        throw new AppError(
          "More than 1,000 commits accumulated. Re-import this branch to establish a new baseline.",
          422,
        );
      commits.push(...result.commits);
      if (commits.length >= result.total_commits || !result.commits.length)
        break;
    } catch (error) {
      // A force-push may remove the old cursor. The full immutable tree is still authoritative.
      if (error instanceof AppError && error.status === 404) return [head];
      throw error;
    }
  }
  if (!commits.some((commit) => commit.sha === head.sha)) commits.push(head);
  return commits;
}

import "server-only";
import { z } from "zod";

const optional = (schema: z.ZodType<string>) =>
  z.preprocess(
    (value) => (typeof value === "string" ? value.trim() || undefined : value),
    schema.optional(),
  );

const httpUrl = z
  .string()
  .url()
  .refine(
    (value) => /^https?:\/\//.test(value),
    "Must use http:// or https://",
  );

export const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: optional(
    z
      .string()
      .url()
      .refine(
        (value) => /^postgres(?:ql)?:\/\//.test(value),
        "Must be a PostgreSQL connection URL",
      ),
  ),
  LLM_API_KEY: optional(z.string().min(1)),
  LLM_BASE_URL: optional(httpUrl),
  LLM_MODEL: optional(z.string().min(1)),
  HUGGINGFACE_API_KEY: optional(z.string().min(1)),
  QDRANT_URL: optional(httpUrl),
  QDRANT_API_KEY: optional(z.string().min(1)),
  GITHUB_TOKEN: optional(z.string().min(1)),
  GITHUB_WEBHOOK_SECRET: optional(
    z.string().min(16, "Use at least 16 characters"),
  ),
  HUGGINGFACE_EMBEDDING_MODEL: z
    .string()
    .trim()
    .min(1)
    .default("BAAI/bge-small-en-v1.5"),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().min(1).max(65536).default(384),
  QDRANT_COLLECTION: z
    .string()
    .regex(/^[a-zA-Z0-9_-]+$/)
    .default("docsmith_documents"),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(input: Record<string, unknown>): Env {
  const result = envSchema.safeParse(input);
  if (!result.success) {
    // Only report field names and validation messages, never submitted secrets.
    throw new Error(
      `Invalid environment configuration: ${result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  }
  return result.data;
}

let cached: Env | undefined;

export function getEnv(): Env {
  return (cached ??= parseEnv(process.env));
}

export function requireEnv<K extends keyof Env>(
  ...keys: K[]
): Env & { [P in K]-?: NonNullable<Env[P]> } {
  const env = getEnv();
  const missing = keys.filter((key) => env[key] === undefined);
  if (missing.length) {
    throw new Error(
      `Configure ${missing.join(", ")} in .env.local before using this feature.`,
    );
  }
  return env as Env & { [P in K]-?: NonNullable<Env[P]> };
}

export function getConfiguration() {
  const env = getEnv();
  return {
    database: Boolean(env.DATABASE_URL),
    llm: Boolean(env.LLM_API_KEY && env.LLM_BASE_URL && env.LLM_MODEL),
    embeddings: Boolean(env.HUGGINGFACE_API_KEY),
    vectorStore: Boolean(env.QDRANT_URL && env.QDRANT_API_KEY),
    github: Boolean(env.GITHUB_TOKEN),
    webhook: Boolean(env.GITHUB_WEBHOOK_SECRET),
  };
}

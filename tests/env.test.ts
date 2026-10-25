import assert from "node:assert/strict";
import test from "node:test";
import { parseEnv } from "../src/lib/env";

test("empty setup is valid and optional blank secrets become undefined", () => {
  const env = parseEnv({ LLM_API_KEY: "  ", DATABASE_URL: "" });
  assert.equal(env.LLM_API_KEY, undefined);
  assert.equal(env.DATABASE_URL, undefined);
  assert.equal(env.EMBEDDING_DIMENSIONS, 384);
});
test("accepts Neon URLs and converts embedding dimensions", () => {
  const env = parseEnv({
    DATABASE_URL: "postgresql://user:secret@host/db?sslmode=require",
    EMBEDDING_DIMENSIONS: "768",
  });
  assert.equal(env.EMBEDDING_DIMENSIONS, 768);
});
test("rejects invalid service URLs and dimensions without echoing secrets", () => {
  for (const input of [
    { DATABASE_URL: "https://host/db" },
    { LLM_BASE_URL: "file:///secret" },
    { EMBEDDING_DIMENSIONS: "NaN" },
    { EMBEDDING_DIMENSIONS: "0" },
  ])
    assert.throws(() => parseEnv(input), /Invalid environment configuration/);
  const secret = "do-not-print-this-private-token";
  assert.throws(
    () => parseEnv({ LLM_API_KEY: secret, QDRANT_URL: "invalid" }),
    (error: unknown) =>
      error instanceof Error &&
      !error.message.includes(secret) &&
      error.message.includes("QDRANT_URL"),
  );
});

import assert from "node:assert/strict";
import test from "node:test";
import { chatCompletion } from "../src/lib/llm";

process.env.LLM_API_KEY = "test-only-key";
process.env.LLM_BASE_URL = "https://provider.example/v1/";
process.env.LLM_MODEL = "test-model";

test("uses the configured OpenAI-compatible endpoint and model", async (context) => {
  context.mock.method(
    globalThis,
    "fetch",
    async (url: string | URL | Request, options?: RequestInit) => {
      assert.equal(url, "https://provider.example/v1/chat/completions");
      const body = JSON.parse(String(options?.body)) as {
        model: string;
        messages: unknown[];
      };
      assert.equal(body.model, "test-model");
      assert.equal(body.messages.length, 1);
      return Response.json({
        choices: [{ message: { content: "  # Documentation  " } }],
      });
    },
  );
  assert.equal(
    await chatCompletion([{ role: "user", content: "Document this code." }]),
    "# Documentation",
  );
});

test("rejects empty provider output and reports transport failures", async (context) => {
  const fetchMock = context.mock.method(globalThis, "fetch", async () =>
    Response.json({ choices: [{ message: { content: null } }] }),
  );
  await assert.rejects(() => chatCompletion([]), /empty or unsupported/);
  fetchMock.mock.mockImplementation(async () => {
    throw new TypeError("network failure");
  });
  await assert.rejects(
    () => chatCompletion([]),
    /Could not reach the LLM provider/,
  );
});

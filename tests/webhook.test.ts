import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { verifyWebhookSignature } from "../src/lib/webhook";

test("accepts only the HMAC of the exact raw request bytes", () => {
  const secret = "a-test-webhook-secret";
  const body = '{"ref":"refs/heads/main"}';
  const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  assert.equal(verifyWebhookSignature(body, signature, secret), true);
  assert.equal(verifyWebhookSignature(`${body}\n`, signature, secret), false);
  assert.equal(verifyWebhookSignature(body, signature, "wrong-secret"), false);
  for (const invalid of [
    null,
    "",
    "sha256=abc",
    `sha1=${"0".repeat(64)}`,
    `sha256=${"z".repeat(64)}`,
  ])
    assert.equal(verifyWebhookSignature(body, invalid, secret), false);
});

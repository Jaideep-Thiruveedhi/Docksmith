import assert from "node:assert/strict";
import test from "node:test";
import { normalizeEmbedding } from "../src/lib/embeddings";

test("normalizes sentence vectors and mean-pools token matrices", () => {
  assert.deepEqual(normalizeEmbedding([3, 4], 2), [0.6, 0.8]);
  for (const value of normalizeEmbedding(
    [
      [2, 0],
      [0, 2],
    ],
    2,
  ))
    assert.ok(Math.abs(value - Math.SQRT1_2) < 1e-12);
  assert.deepEqual(normalizeEmbedding([[[3, 4]]], 2), [0.6, 0.8]);
});
test("rejects wrong dimensions, non-finite values and empty embeddings", () => {
  for (const value of [[], [0, 0], [1], [NaN, 2], [[1], [1, 2]], ["a", 2]])
    assert.throws(() => normalizeEmbedding(value, 2));
});

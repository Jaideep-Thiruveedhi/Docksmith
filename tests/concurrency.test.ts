import assert from "node:assert/strict";
import test from "node:test";
import { mapLimit } from "../src/lib/concurrency";

test("limits work in flight and preserves input order", async () => {
  let active = 0;
  let peak = 0;
  const values = await mapLimit([3, 1, 2, 4], 2, async (value) => {
    peak = Math.max(peak, ++active);
    await new Promise((resolve) => setTimeout(resolve, value * 2));
    active--;
    return value * 2;
  });
  assert.equal(peak, 2);
  assert.deepEqual(values, [6, 2, 4, 8]);
  await assert.rejects(() => mapLimit([1], 0, async (value) => value));
});

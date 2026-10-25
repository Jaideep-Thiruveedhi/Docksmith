import assert from "node:assert/strict";
import test from "node:test";
import { classifyStaleness } from "../src/lib/staleness";

const published = { signatureHash: "signature", bodyHash: "body" };
test("classifies removal, contract drift, implementation drift and related changes", () => {
  assert.equal(classifyStaleness(null, published).status, "BROKEN");
  assert.equal(
    classifyStaleness({ ...published, signatureHash: "changed" }, published)
      .status,
    "BROKEN",
  );
  assert.equal(
    classifyStaleness({ ...published, bodyHash: "changed" }, published).status,
    "POTENTIALLY_OUTDATED",
  );
  assert.equal(
    classifyStaleness(published, published, true).status,
    "REVIEW_RECOMMENDED",
  );
  assert.equal(classifyStaleness(published, published).status, "OK");
});
test("drift persists until the published baseline catches up", () => {
  const current = { ...published, bodyHash: "new body" };
  assert.equal(
    classifyStaleness(current, published).status,
    "POTENTIALLY_OUTDATED",
  );
  assert.equal(
    classifyStaleness({ ...current }, published).status,
    "POTENTIALLY_OUTDATED",
  );
  assert.equal(classifyStaleness(current, current).status, "OK");
  assert.equal(classifyStaleness(current, null).status, "OK");
});

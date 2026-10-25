import assert from "node:assert/strict";
import test from "node:test";
import { getSnapshot, isSourceFile, parseGitHubUrl } from "../src/lib/github";

test("accepts canonical GitHub URLs and rejects other origins and URL credentials", () => {
  assert.deepEqual(parseGitHubUrl("https://github.com/Owner/Repo.git/"), {
    owner: "owner",
    name: "repo",
  });
  for (const url of [
    "https://evil.test/a/b",
    "http://github.com/a/b",
    "https://token@github.com/a/b",
    "https://github.com/a/b/tree/main",
    "https://github.com/a/b?token=private",
    "https://github.com:8080/a/b",
  ])
    assert.equal(parseGitHubUrl(url), null);
});
test("filters generated dependencies and declaration files", () => {
  for (const path of [
    "src/index.ts",
    "app/page.tsx",
    "service.py",
    "lib/index.mjs",
  ])
    assert.equal(isSourceFile(path), true);
  for (const path of [
    "node_modules/package/index.js",
    "src/generated/prisma/index.ts",
    "dist/index.js",
    "types.d.ts",
    "image.png",
  ])
    assert.equal(isSourceFile(path), false);
});
test("rejects truncated trees and anchors file discovery to the commit's tree", async (context) => {
  const paths: string[] = [];
  context.mock.method(
    globalThis,
    "fetch",
    async (url: string | URL | Request) => {
      paths.push(String(url));
      return Response.json(
        paths.length === 1
          ? {
              sha: "head-sha",
              commit: {
                message: "change",
                author: { name: "Author", date: "2026-01-01T00:00:00Z" },
                committer: null,
                tree: { sha: "tree-sha" },
              },
            }
          : { truncated: true, tree: [] },
      );
    },
  );
  await assert.rejects(() => getSnapshot("owner", "repo", "main"), /truncated/);
  assert.ok(paths[1].includes("/git/trees/tree-sha"));
});

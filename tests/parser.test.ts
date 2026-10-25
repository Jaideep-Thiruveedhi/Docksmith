import assert from "node:assert/strict";
import test from "node:test";
import { parseCode } from "../src/lib/parsers";

const named = (source: string, path: string, name: string) => {
  const unit = parseCode(source, path).find((unit) => unit.name === name);
  assert.ok(unit, `Expected code unit ${name}`);
  return unit;
};
test("parses TypeScript functions, arrows, classes and scoped methods", () => {
  const units = parseCode(
    "export function add(a: number, b: number): number { return a + b; }\nexport const square = (x: number) => x * x;\nclass First { run(x: string) { return x; } }\nclass Second { run() { return 2; } }",
    "math.ts",
  );
  assert.ok(units.some((unit) => unit.type === "MODULE"));
  assert.ok(
    units.some((unit) => unit.name === "add" && unit.type === "FUNCTION"),
  );
  assert.ok(units.some((unit) => unit.name === "square"));
  assert.ok(
    units.some((unit) => unit.name === "First.run" && unit.type === "METHOD"),
  );
  assert.ok(units.some((unit) => unit.name === "Second.run"));
  assert.equal(new Set(units.map((unit) => unit.key)).size, units.length);
});
test("hashes ignore comments and formatting but preserve string content", () => {
  const before = named(
    'function greet(name) { return "hello world" + name; }',
    "a.js",
    "greet",
  );
  const formatted = named(
    'function greet ( name ) {\n// comment\nreturn "hello world" + name\n}',
    "a.js",
    "greet",
  );
  assert.equal(before.signatureHash, formatted.signatureHash);
  assert.equal(before.bodyHash, formatted.bodyHash);
  const changed = named(
    'function greet(name) { return "helloworld" + name; }',
    "a.js",
    "greet",
  );
  assert.notEqual(before.bodyHash, changed.bodyHash);
});
test("signature hashes capture parameter, return type and async changes", () => {
  const before = named(
    "function load(x: string): string { return x; }",
    "a.ts",
    "load",
  );
  for (const code of [
    "function load(x: number): string { return String(x); }",
    "async function load(x: string): Promise<string> { return x; }",
  ])
    assert.notEqual(
      before.signatureHash,
      named(code, "a.ts", "load").signatureHash,
    );
});
test("body changes keep signature hashes stable; TSX and default exports parse", () => {
  const before = named(
    "export const value = (x: number) => x + 1;",
    "a.ts",
    "value",
  );
  const after = named(
    "export const value = (x: number) => x + 2;",
    "a.ts",
    "value",
  );
  assert.equal(before.signatureHash, after.signatureHash);
  assert.notEqual(before.bodyHash, after.bodyHash);
  assert.ok(
    parseCode("export default () => <main>Hello</main>", "page.tsx").some(
      (unit) => unit.name === "default",
    ),
  );
});
test("Python parser handles async, multiline signatures, classes and nested functions", () => {
  const source =
    "class Service:\n    async def fetch(\n        self,\n        key: str,\n    ) -> str:\n        return key\n\ndef outer(x):\n    def inner(y):\n        return y + 1\n    return inner(x)\n";
  const units = parseCode(source, "service.py");
  assert.ok(
    units.some((unit) => unit.name === "Service" && unit.type === "CLASS"),
  );
  assert.ok(
    units.some(
      (unit) => unit.name === "Service.fetch" && unit.type === "METHOD",
    ),
  );
  assert.ok(
    units.some(
      (unit) => unit.name === "outer.inner" && unit.type === "FUNCTION",
    ),
  );
  assert.equal(
    units.find((unit) => unit.name === "Service.fetch")?.startLine,
    2,
  );
});
test("Python fingerprints ignore formatting and detect meaningful changes", () => {
  const before = named("def add(x):\n    return x + 1\n", "a.py", "add");
  const formatted = named(
    "def add( x ):\n    # comment\n    return x+1\n",
    "a.py",
    "add",
  );
  assert.equal(before.signatureHash, formatted.signatureHash);
  assert.equal(before.bodyHash, formatted.bodyHash);
  assert.notEqual(
    before.bodyHash,
    named("def add(x):\n    return x + 2\n", "a.py", "add").bodyHash,
  );
});
test("syntax failures are not silently turned into an empty repository", () => {
  assert.throws(() => parseCode("export function {", "bad.ts"));
  assert.throws(() => parseCode("def :\n   return 1", "bad.py"));
});

test("object methods have stable qualified identities and Python decorators affect signatures", () => {
  const units = parseCode(
    "const a = { run() { return 1; } }; const b = { run() { return 2; } };",
    "a.js",
  );
  assert.ok(units.some((unit) => unit.name === "a.run"));
  assert.ok(units.some((unit) => unit.name === "b.run"));
  const before = named("@cache\ndef load(x):\n    return x\n", "a.py", "load");
  const after = named("@retry\ndef load(x):\n    return x\n", "a.py", "load");
  assert.notEqual(before.signatureHash, after.signatureHash);
});

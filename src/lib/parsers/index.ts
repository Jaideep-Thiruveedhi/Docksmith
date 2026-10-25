import { createHash } from "node:crypto";
import { parse } from "@babel/parser";
import generatorModule from "@babel/generator";
import * as t from "@babel/types";
import { parser as pythonParser } from "@lezer/python";
import type { SyntaxNode } from "@lezer/common";

export interface ParsedUnit {
  key: string;
  type: "FUNCTION" | "CLASS" | "METHOD" | "MODULE";
  name: string;
  signature: string;
  body: string;
  startLine: number;
  endLine: number;
  signatureHash: string;
  bodyHash: string;
}

const generate =
  (generatorModule as unknown as { default?: typeof generatorModule })
    .default ?? generatorModule;
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const canonical = (node: t.Node) =>
  generate(node, { comments: false, compact: true }).code;

export function languageForPath(path: string): string {
  return path.endsWith(".py")
    ? "python"
    : /\.(?:ts|tsx|mts|cts)$/.test(path)
      ? "typescript"
      : "javascript";
}

function parseJavaScript(code: string, path: string): ParsedUnit[] {
  const ast = parse(code, {
    sourceType: "unambiguous",
    plugins: [
      "jsx",
      ...(languageForPath(path) === "typescript"
        ? ["typescript" as const]
        : []),
      "decorators-legacy",
    ],
    errorRecovery: false,
  });
  const units: ParsedUnit[] = [];
  const occurrences = new Map<string, number>();

  function add(
    node: t.Function | t.Class | t.ObjectMethod,
    type: ParsedUnit["type"],
    name: string,
  ) {
    if (node.start == null || node.end == null || !node.loc || !node.body)
      return;
    const header = t.cloneNode(node, true);
    if (t.isClass(header)) header.body = t.classBody([]);
    else header.body = t.blockStatement([]);
    const baseKey = `${type}:${name}`;
    const count = (occurrences.get(baseKey) ?? 0) + 1;
    occurrences.set(baseKey, count);
    const signature = code
      .slice(node.start, node.body.start ?? node.start)
      .trim()
      .replace(/\s*=>\s*$/, "")
      .trim();
    units.push({
      key: count === 1 ? baseKey : `${baseKey}#${count}`,
      type,
      name,
      signature: signature || name,
      body: code.slice(node.start, node.end),
      startLine: node.loc.start.line,
      endLine: node.loc.end.line,
      signatureHash: hash(canonical(header)),
      bodyHash: hash(canonical(node.body)),
    });
  }

  function memberName(node: t.Node | null | undefined): string | null {
    if (!node) return null;
    if (t.isIdentifier(node)) return node.name;
    if (t.isPrivateName(node)) return `#${node.id.name}`;
    if (t.isStringLiteral(node) || t.isNumericLiteral(node))
      return String(node.value);
    if (t.isMemberExpression(node)) {
      const object = memberName(node.object);
      const property = memberName(node.property);
      return object && property ? `${object}.${property}` : null;
    }
    return null;
  }

  function walk(node: t.Node, scope: string[], parent?: t.Node) {
    let nextScope = scope;
    if (t.isObjectExpression(node)) {
      const owner = t.isVariableDeclarator(parent)
        ? memberName(parent.id)
        : t.isObjectProperty(parent)
          ? memberName(parent.key)
          : t.isAssignmentExpression(parent)
            ? memberName(parent.left)
            : null;
      if (owner) nextScope = [...scope, owner];
    } else if (t.isClass(node)) {
      const local =
        node.id?.name ??
        (t.isVariableDeclarator(parent) ? memberName(parent.id) : "default") ??
        "anonymous";
      const name = [...scope, local].join(".");
      add(node, "CLASS", name);
      nextScope = [...scope, local];
    } else if (t.isFunction(node) && node.body) {
      const local =
        t.isFunctionDeclaration(node) || t.isFunctionExpression(node)
          ? node.id?.name
          : undefined;
      const inferred =
        local ??
        (t.isVariableDeclarator(parent) ? memberName(parent.id) : null) ??
        (t.isAssignmentExpression(parent) ? memberName(parent.left) : null) ??
        (t.isClassMethod(node) ||
        t.isClassPrivateMethod(node) ||
        t.isObjectMethod(node)
          ? memberName(node.key)
          : null) ??
        (t.isObjectProperty(parent) || t.isClassProperty(parent)
          ? memberName(parent.key)
          : null) ??
        (t.isExportDefaultDeclaration(parent) ? "default" : null);
      if (inferred) {
        const method =
          t.isClassMethod(node) ||
          t.isClassPrivateMethod(node) ||
          t.isObjectMethod(node) ||
          t.isClassProperty(parent);
        const kind =
          (t.isClassMethod(node) || t.isObjectMethod(node)) &&
          node.kind !== "method" &&
          node.kind !== "constructor"
            ? `${node.kind} `
            : "";
        add(
          node,
          method ? "METHOD" : "FUNCTION",
          [...scope, `${kind}${inferred}`].join("."),
        );
        nextScope = [...scope, inferred];
      }
    }
    for (const key of t.VISITOR_KEYS[node.type] ?? []) {
      const child = (node as unknown as Record<string, unknown>)[key];
      if (Array.isArray(child)) {
        for (const item of child)
          if (item && typeof item === "object" && "type" in item)
            walk(item as t.Node, nextScope, node);
      } else if (child && typeof child === "object" && "type" in child)
        walk(child as t.Node, nextScope, node);
    }
  }
  walk(ast.program, []);
  units.unshift({
    key: "MODULE:module",
    type: "MODULE",
    name: path,
    signature: `module ${path}`,
    body: code,
    startLine: 1,
    endLine: Math.max(1, code.split("\n").length),
    signatureHash: hash(`module ${path}`),
    bodyHash: hash(canonical(ast.program)),
  });
  return units;
}

function parsePython(code: string, path: string): ParsedUnit[] {
  const tree = pythonParser.parse(code);
  const units: ParsedUnit[] = [];
  const occurrences = new Map<string, number>();
  const lineAt = (offset: number) => code.slice(0, offset).split("\n").length;

  function canonicalPython(node: SyntaxNode): string {
    if (node.type.isError)
      throw new Error(`Invalid Python syntax near line ${lineAt(node.from)}.`);
    if (node.name === "Comment") return "";
    const parts: string[] = [];
    for (let child = node.firstChild; child; child = child.nextSibling)
      parts.push(canonicalPython(child));
    return parts.length
      ? `${node.name}(${parts.filter(Boolean).join(",")})`
      : `${node.name}:${code.slice(node.from, node.to)}`;
  }
  const fullCanonical = canonicalPython(tree.topNode);

  function walk(node: SyntaxNode, scope: string[], parentKind?: string) {
    let nextScope = scope;
    let kind = parentKind;
    if (node.name === "FunctionDefinition" || node.name === "ClassDefinition") {
      const identifier = node.getChild("VariableName");
      const body = node.getChild("Body");
      if (identifier && body) {
        const sourceStart =
          node.parent?.name === "DecoratedStatement"
            ? node.parent.from
            : node.from;
        const local = code.slice(identifier.from, identifier.to);
        const name = [...scope, local].join(".");
        const type =
          node.name === "ClassDefinition"
            ? "CLASS"
            : parentKind === "CLASS"
              ? "METHOD"
              : "FUNCTION";
        const baseKey = `${type}:${name}`;
        const count = (occurrences.get(baseKey) ?? 0) + 1;
        occurrences.set(baseKey, count);
        const header: string[] = [];
        if (node.parent?.name === "DecoratedStatement") {
          for (
            let sibling = node.parent.firstChild;
            sibling && sibling.from < node.from;
            sibling = sibling.nextSibling
          )
            header.push(canonicalPython(sibling));
        }
        for (
          let child = node.firstChild;
          child && child.from < body.from;
          child = child.nextSibling
        )
          header.push(canonicalPython(child));
        units.push({
          key: count === 1 ? baseKey : `${baseKey}#${count}`,
          type,
          name,
          signature: code
            .slice(sourceStart, body.from)
            .trim()
            .replace(/:$/, ""),
          body: code.slice(sourceStart, node.to),
          startLine: lineAt(sourceStart),
          endLine: lineAt(Math.max(node.from, node.to - 1)),
          signatureHash: hash(header.join(",")),
          bodyHash: hash(canonicalPython(body)),
        });
        nextScope = [...scope, local];
        kind = type;
      }
    }
    for (let child = node.firstChild; child; child = child.nextSibling)
      walk(child, nextScope, kind);
  }
  walk(tree.topNode, []);
  units.unshift({
    key: "MODULE:module",
    type: "MODULE",
    name: path,
    signature: `module ${path}`,
    body: code,
    startLine: 1,
    endLine: Math.max(1, code.split("\n").length),
    signatureHash: hash(`module ${path}`),
    bodyHash: hash(fullCanonical),
  });
  return units;
}

export function parseCode(code: string, path: string): ParsedUnit[] {
  return languageForPath(path) === "python"
    ? parsePython(code, path)
    : parseJavaScript(code, path);
}

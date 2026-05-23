import type { Element, Root } from "hast";
import { visit } from "unist-util-visit";

const SEMANTIC_NAMES: Record<string, string> = {
  nav: "Nav",
  footer: "Footer",
  header: "Header",
  aside: "Aside",
  article: "Article",
  section: "Section",
};

export type SubtreeCandidate = {
  fingerprint: string;
  node: Element;
  depth: number;
  nodeCount: number;
  charCount: number;
  tagName: string;
};

function normalizeAttrValue(name: string, value: string, structural = false): string {
  if (structural && (name === "href" || name === "src")) {
    return "*.resource";
  }
  if (name === "id") {
    return value.replace(/\d+/g, "*");
  }
  if (name === "class") {
    return value.split(/\s+/).filter(Boolean).sort().join(".");
  }
  if (name === "href" || name === "src") {
    try {
      const u = new URL(value, "https://example.com");
      return `${u.pathname}`;
    } catch {
      return value.replace(/[^/]+\.\w+$/i, "*.ext");
    }
  }
  return value;
}

export function fingerprintElement(node: Element, options: { structural?: boolean } = {}): string {
  const structural = options.structural ?? false;
  const attrParts: string[] = [];
  for (const [key, val] of Object.entries(node.properties ?? {})) {
    if (key.startsWith("on")) {
      continue;
    }
    const str = Array.isArray(val) ? val.join(" ") : String(val ?? "");
    attrParts.push(`${key}=${normalizeAttrValue(key, str, structural)}`);
  }
  attrParts.sort();
  const attrs = attrParts.join("|");

  const childParts: string[] = [];
  for (const child of node.children ?? []) {
    if (child.type === "text") {
      const t = child.value.trim();
      if (t) {
        childParts.push("#t");
      }
      continue;
    }
    if (child.type === "element") {
      childParts.push(fingerprintElement(child, options));
    }
  }

  return `${node.tagName}[${attrs}](${childParts.join(",")})`;
}

function countNodes(node: Element): number {
  let n = 1;
  for (const child of node.children ?? []) {
    if (child.type === "element") {
      n += countNodes(child);
    }
  }
  return n;
}

function countChars(node: Element): number {
  let n = 0;
  visit(node, (n2) => {
    if (n2.type === "text") {
      n += n2.value.length;
    }
  });
  return n;
}

export function collectSubtreeCandidates(
  root: Root,
  options: { minNodes?: number; minChars?: number } = {},
): SubtreeCandidate[] {
  const minNodes = options.minNodes ?? 3;
  const minChars = options.minChars ?? 4;
  const skipTags = new Set(["html", "head", "body", "main"]);
  const alwaysAllowTags = new Set(["nav", "header", "footer", "aside"]);
  const results: SubtreeCandidate[] = [];

  visit(root, "element", (node, index, parent) => {
    if (skipTags.has(node.tagName)) {
      return;
    }
    if (
      !alwaysAllowTags.has(node.tagName) &&
      parent &&
      parent.type === "element" &&
      skipTags.has(parent.tagName) &&
      (parent.children?.length ?? 0) <= 1
    ) {
      return;
    }

    const nodeCount = countNodes(node);
    const charCount = countChars(node);
    if (nodeCount < minNodes || charCount < minChars) {
      return;
    }

    results.push({
      fingerprint: fingerprintElement(node, { structural: true }),
      node,
      depth: 0,
      nodeCount,
      charCount,
      tagName: node.tagName,
    });
  });

  return results;
}

export function componentNameFromTag(tagName: string, fingerprint: string): string {
  if (SEMANTIC_NAMES[tagName]) {
    return SEMANTIC_NAMES[tagName];
  }
  const hash = fingerprint
    .slice(-12)
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 6);
  return `Block${hash || "Part"}`;
}

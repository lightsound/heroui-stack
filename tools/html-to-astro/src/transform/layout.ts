import type { Element, RootContent } from "hast";
import { toHtml } from "hast-util-to-html";
import { visit } from "unist-util-visit";

import { findChildElement, findElement, getChildren, parseHtmlDocument } from "../parse/html.ts";
import type { ExcludedItem } from "../types.ts";
import { processScriptElement } from "./scripts.ts";

const UNSUPPORTED_TAGS = new Set(["iframe", "template"]);
const INTERACTION_ATTRS = ["onclick", "onchange", "onsubmit", "oninput", "onkeydown", "onkeyup"];
const INTERACTION_ATTR_LOOKUP = new Map(
  INTERACTION_ATTRS.flatMap((attr) => {
    const camel =
      attr === "onclick"
        ? "onClick"
        : attr === "onkeydown"
          ? "onKeyDown"
          : attr === "onkeyup"
            ? "onKeyUp"
            : `on${attr.slice(2, 3).toUpperCase()}${attr.slice(3)}`;
    return [
      [attr, attr],
      [camel, attr],
    ];
  }),
);

function findInteractionAttrs(properties: Element["properties"] | undefined): string[] {
  const found = new Set<string>();
  for (const [key, value] of Object.entries(properties ?? {})) {
    if (!value) {
      continue;
    }
    const attr = INTERACTION_ATTR_LOOKUP.get(key);
    if (attr) {
      found.add(attr);
    }
  }
  return [...found];
}

export type SplitPage = {
  title: string;
  headHtml: string;
  bodyHtml: string;
  stylesheetHrefs: string[];
  warnings: Array<{ path: string; message: string }>;
};

function elementChildrenToHtml(
  nodes: RootContent[],
  reportPath: string,
  excluded: ExcludedItem[],
): string {
  const processed: RootContent[] = [];
  for (const node of nodes) {
    if (node.type === "element" && node.tagName === "script") {
      const updated = processScriptElement(node, reportPath, excluded);
      if (updated) {
        processed.push(updated);
      }
      continue;
    }
    if (node.type === "element") {
      processed.push(transformElement(node, reportPath, excluded));
      continue;
    }
    processed.push(node);
  }
  return toHtml({ type: "root", children: processed });
}

function transformElement(node: Element, reportPath: string, excluded: ExcludedItem[]): Element {
  const children = node.children?.map((child) => {
    if (child.type !== "element") {
      return child;
    }
    if (child.tagName === "script") {
      const updated = processScriptElement(child, reportPath, excluded);
      return updated ?? { type: "text" as const, value: "" };
    }
    return transformElement(child, reportPath, excluded);
  });
  return { ...node, children: children ?? [] };
}

export function splitHtmlPage(
  source: string,
  reportPath: string,
  excluded: ExcludedItem[],
): SplitPage {
  const tree = parseHtmlDocument(source);
  const warnings: SplitPage["warnings"] = [];

  visit(tree, "element", (node) => {
    if (UNSUPPORTED_TAGS.has(node.tagName)) {
      warnings.push({
        path: reportPath,
        message: `Unsupported element <${node.tagName}> — verify manually after conversion`,
      });
    }
    if (node.tagName.includes("-")) {
      warnings.push({
        path: reportPath,
        message: `Possible Web Component <${node.tagName}> — not converted to Astro component`,
      });
    }
    for (const attr of findInteractionAttrs(node.properties)) {
      warnings.push({
        path: reportPath,
        message: `Interactive attribute ${attr} detected — may need client:* hydration (not applied automatically)`,
      });
    }
  });

  const htmlEl = findElement(tree, "html");
  const headEl = htmlEl ? findChildElement(htmlEl, "head") : findElement(tree, "head");
  const bodyEl = htmlEl ? findChildElement(htmlEl, "body") : findElement(tree, "body");

  let title = "";
  const stylesheetHrefs: string[] = [];

  const headNodes: RootContent[] = [];
  if (headEl) {
    for (const child of getChildren(headEl)) {
      if (child.type === "element" && child.tagName === "title") {
        const text = child.children?.[0];
        if (text && text.type === "text") {
          title = text.value.trim();
        }
        continue;
      }
      if (child.type === "element" && child.tagName === "link") {
        const rel = String(child.properties?.rel ?? "");
        const href = String(child.properties?.href ?? "");
        if (/\bstylesheet\b/.test(rel) && href) {
          stylesheetHrefs.push(href);
          continue;
        }
      }
      if (child.type === "element" && child.tagName === "script") {
        const updated = processScriptElement(child, reportPath, excluded);
        if (updated) {
          headNodes.push(updated);
        }
        continue;
      }
      headNodes.push(child);
    }
  }

  const bodyNodes = bodyEl ? getChildren(bodyEl) : getChildren(tree);
  const headHtml =
    headNodes.length > 0 ? elementChildrenToHtml(headNodes, reportPath, excluded) : "";
  const bodyHtml = elementChildrenToHtml(bodyNodes, reportPath, excluded);

  return { title, headHtml, bodyHtml, stylesheetHrefs, warnings };
}

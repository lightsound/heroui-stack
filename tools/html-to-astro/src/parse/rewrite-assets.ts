import type { Root } from "hast";
import { toHtml } from "hast-util-to-html";
import { visit } from "unist-util-visit";

import type { ExcludedItem } from "../types.ts";
import { ingestAssetFile } from "./assets.ts";

export function rewriteAssetUrlsInTree(
  tree: Root,
  rootDir: string,
  publicDir: string,
  reportPath: string,
  excluded: ExcludedItem[],
): string {
  visit(tree, "element", (node) => {
    if (node.tagName === "script" || node.tagName === "img" || node.tagName === "source") {
      const src = getHref(node.properties?.src);
      if (src) {
        const rewritten = ingestAssetFile(rootDir, src, publicDir, reportPath, excluded);
        if (rewritten) {
          node.properties = { ...node.properties, src: rewritten };
        }
      }
    }
    if (node.tagName === "link") {
      const href = getHref(node.properties?.href);
      const rel = String(node.properties?.rel ?? "");
      if (href && rel.includes("stylesheet")) {
        const rewritten = ingestAssetFile(rootDir, href, publicDir, reportPath, excluded);
        if (rewritten) {
          node.properties = { ...node.properties, href: rewritten };
        }
      }
    }
    if (node.tagName === "a") {
      const href = getHref(node.properties?.href);
      if (
        href &&
        !href.startsWith("#") &&
        !href.startsWith("mailto:") &&
        !href.startsWith("tel:")
      ) {
        const rewritten = ingestAssetFile(rootDir, href, publicDir, reportPath, excluded);
        if (rewritten && rewritten.startsWith("/")) {
          node.properties = { ...node.properties, href: rewritten };
        }
      }
    }
  });

  return toHtml(tree);
}

function getHref(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }
  return undefined;
}

import type { Element, Root, RootContent } from "hast";
import { fromHtml } from "hast-util-from-html";
import { visit } from "unist-util-visit";

export function parseHtmlDocument(source: string): Root {
  const isFragment = !/<html[\s>]/i.test(source);
  return fromHtml(source, { fragment: isFragment });
}

export function findElement(root: Root, tagName: string): Element | undefined {
  let found: Element | undefined;
  visit(root, "element", (node) => {
    if (!found && node.tagName === tagName) {
      found = node;
    }
  });
  return found;
}

export function getChildren(element: Element | Root): RootContent[] {
  return element.children ?? [];
}

export function findChildElement(parent: Element, tagName: string): Element | undefined {
  for (const child of getChildren(parent)) {
    if (child.type === "element" && child.tagName === tagName) {
      return child;
    }
  }
  return undefined;
}

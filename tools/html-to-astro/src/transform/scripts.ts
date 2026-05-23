import type { Element } from "hast";

import type { ExcludedItem } from "../types.ts";
import { checkWorkersCompatible, snippetPreview } from "../validate/workers-compat.ts";

export function getScriptContent(element: Element): string {
  const child = element.children?.[0];
  if (child && child.type === "text") {
    return child.value;
  }
  return "";
}

export function shouldUseInlineDirective(element: Element, content: string): boolean {
  const type = getAttr(element, "type");
  if (type && type !== "module" && type !== "text/javascript" && type !== "") {
    return true;
  }
  if (getAttr(element, "src")) {
    return false;
  }
  return !/\bimport\s+/.test(content) || type === "module";
}

function getAttr(element: Element, name: string): string | undefined {
  const prop = element.properties?.[name];
  if (typeof prop === "string") {
    return prop;
  }
  if (Array.isArray(prop) && typeof prop[0] === "string") {
    return prop[0];
  }
  return undefined;
}

export function processScriptElement(
  element: Element,
  reportPath: string,
  excluded: ExcludedItem[],
): Element | null {
  const src = getAttr(element, "src");
  if (src) {
    return {
      ...element,
      properties: {
        ...element.properties,
        "is:inline": true,
      },
    };
  }

  const content = getScriptContent(element);
  const check = checkWorkersCompatible(content);
  if (!check.compatible) {
    excluded.push({
      path: reportPath,
      reason: check.reason ?? "Workers incompatible inline script",
      snippet: snippetPreview(content),
    });
    return null;
  }

  const props = { ...element.properties };
  if (shouldUseInlineDirective(element, content)) {
    props["is:inline"] = true;
  }
  return { ...element, properties: props };
}

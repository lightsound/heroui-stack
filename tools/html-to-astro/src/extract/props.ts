import type { Element } from "hast";

import { parseHtmlDocument } from "../parse/html.ts";

export type ComponentProp = {
  name: string;
  path: number[];
  parentTag: string;
};

export type PropInstance = {
  html: string;
  propValues: Record<string, string>;
};

export type PropsAnalysis = {
  props: ComponentProp[];
  templateHtml: string;
  instances: PropInstance[];
};

const TAG_PROP_BASE: Record<string, string> = {
  h1: "title",
  h2: "title",
  h3: "title",
  h4: "heading",
  h5: "heading",
  h6: "heading",
  p: "description",
  span: "label",
  a: "label",
  li: "item",
  button: "label",
};

export function pathKey(path: number[]): string {
  return path.join(".");
}

type TextSlot = {
  path: number[];
  parentTag: string;
  text: string;
};

function getElementChildren(node: Element): Element[] {
  return (node.children ?? []).filter((child): child is Element => child.type === "element");
}

function getDirectText(node: Element): string {
  const parts: string[] = [];
  for (const child of node.children ?? []) {
    if (child.type !== "text") {
      continue;
    }
    const trimmed = child.value.trim();
    if (trimmed) {
      parts.push(trimmed);
    }
  }
  return parts.join(" ");
}

function collectTextSlots(node: Element, elementPath: number[] = []): TextSlot[] {
  const elementChildren = getElementChildren(node);
  const directText = getDirectText(node);

  if (directText && elementChildren.length === 0) {
    return [{ path: elementPath, parentTag: node.tagName, text: directText }];
  }

  const slots: TextSlot[] = [];
  for (let index = 0; index < elementChildren.length; index++) {
    const child = elementChildren[index];
    if (child) {
      slots.push(...collectTextSlots(child, [...elementPath, index]));
    }
  }
  return slots;
}

function allocatePropName(parentTag: string, used: Set<string>): string {
  const base = TAG_PROP_BASE[parentTag] ?? `${parentTag}Text`;
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base}${suffix}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

function parseRootElement(html: string): Element {
  const tree = parseHtmlDocument(html.trim());
  const elements = tree.children.filter((child): child is Element => child.type === "element");
  if (elements.length !== 1) {
    throw new Error("Expected a single root element for props analysis");
  }
  const root = elements[0];
  if (!root) {
    throw new Error("Expected a single root element for props analysis");
  }
  return root;
}

function getTextAtPath(node: Element, targetPath: number[]): string | null {
  if (targetPath.length === 0) {
    const text = getDirectText(node);
    return text || null;
  }

  const elementChildren = getElementChildren(node);
  const child = elementChildren[targetPath[0] ?? -1];
  if (!child) {
    return null;
  }
  return getTextAtPath(child, targetPath.slice(1));
}

function renderAttrs(node: Element): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(node.properties ?? {})) {
    if (value === undefined || value === null || value === false) {
      continue;
    }
    if (key === "className") {
      const rendered = Array.isArray(value) ? value.join(" ") : String(value);
      if (rendered) {
        parts.push(`class="${rendered}"`);
      }
      continue;
    }
    const rendered = Array.isArray(value) ? value.join(" ") : String(value);
    if (rendered === "") {
      parts.push(key);
      continue;
    }
    parts.push(`${key}="${rendered}"`);
  }
  return parts.length > 0 ? ` ${parts.join(" ")}` : "";
}

function renderTemplateElement(
  node: Element,
  currentPath: number[],
  propsByPath: Map<string, ComponentProp>,
): string {
  const prop = propsByPath.get(pathKey(currentPath));
  const elementChildren = getElementChildren(node);
  const directText = getDirectText(node);

  if (prop && directText && elementChildren.length === 0) {
    return `<${node.tagName}${renderAttrs(node)}>{${prop.name}}</${node.tagName}>`;
  }

  let inner = "";
  let elementIndex = 0;
  for (const child of node.children ?? []) {
    if (child.type === "element") {
      inner += renderTemplateElement(child, [...currentPath, elementIndex], propsByPath);
      elementIndex += 1;
      continue;
    }
    if (child.type === "text" && !prop) {
      inner += child.value;
    }
  }

  return `<${node.tagName}${renderAttrs(node)}>${inner}</${node.tagName}>`;
}

export function analyzePropsFromHtmlInstances(instancesHtml: string[]): PropsAnalysis {
  if (instancesHtml.length === 0) {
    return { props: [], templateHtml: "", instances: [] };
  }

  const roots = instancesHtml.map(parseRootElement);
  const slotSets = roots.map((root) => collectTextSlots(root));
  const referencePaths = slotSets[0] ?? [];

  const props: ComponentProp[] = [];
  const usedNames = new Set<string>();
  const propsByPath = new Map<string, ComponentProp>();

  for (const referenceSlot of referencePaths) {
    const key = pathKey(referenceSlot.path);
    const values = roots.map((root) => getTextAtPath(root, referenceSlot.path) ?? "");
    const uniqueValues = new Set(values);
    if (uniqueValues.size <= 1) {
      continue;
    }

    const name = allocatePropName(referenceSlot.parentTag, usedNames);
    const prop: ComponentProp = {
      name,
      path: referenceSlot.path,
      parentTag: referenceSlot.parentTag,
    };
    props.push(prop);
    propsByPath.set(key, prop);
  }

  const templateRoot = roots[0];
  const templateHtml = templateRoot ? renderTemplateElement(templateRoot, [], propsByPath) : "";

  const instances = instancesHtml.map((html, index) => {
    const root = roots[index];
    const propValues: Record<string, string> = {};
    for (const prop of props) {
      propValues[prop.name] = root ? (getTextAtPath(root, prop.path) ?? "") : "";
    }
    return { html, propValues };
  });

  return { props, templateHtml, instances };
}

export function formatComponentUsage(name: string, propValues: Record<string, string>): string {
  const attrs = Object.entries(propValues)
    .map(([key, value]) => `${key}={${JSON.stringify(value)}}`)
    .join(" ");
  return attrs.length > 0 ? `<${name} ${attrs} />` : `<${name} />`;
}

export function getPrimaryClassName(node: Element): string | undefined {
  const className = node.properties?.className ?? node.properties?.class;
  const value = Array.isArray(className) ? className.join(" ") : String(className ?? "");
  const first = value.split(/\s+/).filter(Boolean)[0];
  return first;
}

export function componentNameFromElement(node: Element, fingerprint: string): string {
  const className = getPrimaryClassName(node);
  if (className) {
    const pascal = className
      .split(/[-_]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join("");
    if (pascal) {
      return pascal;
    }
  }
  return componentNameFromTag(node.tagName, fingerprint);
}

function componentNameFromTag(tagName: string, fingerprint: string): string {
  const SEMANTIC_NAMES: Record<string, string> = {
    nav: "Nav",
    footer: "Footer",
    header: "Header",
    aside: "Aside",
    article: "Article",
    section: "Section",
  };
  if (SEMANTIC_NAMES[tagName]) {
    return SEMANTIC_NAMES[tagName];
  }
  const hash = fingerprint
    .slice(-12)
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 6);
  return `Block${hash || "Part"}`;
}

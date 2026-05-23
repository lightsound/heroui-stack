export type CssRule = {
  selector: string;
  body: string;
  raw: string;
};

export function parseCssRules(css: string): CssRule[] {
  const rules: CssRule[] = [];
  const cleaned = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rulePattern = /([^{]+)\{([^}]*)\}/g;
  let match: RegExpExecArray | null;

  while ((match = rulePattern.exec(cleaned)) !== null) {
    const selector = match[1]?.trim();
    const body = match[2]?.trim();
    if (!selector || !body) {
      continue;
    }

    rules.push({
      selector,
      body,
      raw: `${selector} {\n  ${body}\n}`,
    });
  }

  return rules;
}

export function serializeCssRules(rules: CssRule[]): string {
  return rules
    .map((rule) => rule.raw)
    .join("\n\n")
    .trim();
}

export type SelectorIdentifiers = {
  classes: string[];
  ids: string[];
  tags: string[];
};

export function extractSelectorIdentifiers(selector: string): SelectorIdentifiers {
  const classes = [...selector.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map((match) => match[1] ?? "");
  const ids = [...selector.matchAll(/#([a-zA-Z0-9_-]+)/g)].map((match) => match[1] ?? "");
  const tags = [...selector.matchAll(/(?:^|[\s>+~,(])([a-zA-Z][a-zA-Z0-9-]*)/g)].map(
    (match) => match[1]?.toLowerCase() ?? "",
  );
  return {
    classes: classes.filter(Boolean),
    ids: ids.filter(Boolean),
    tags: tags.filter(Boolean),
  };
}

export function extractMarkupIdentifiers(html: string): SelectorIdentifiers {
  const classes = [...html.matchAll(/class=(?:"([^"]*)"|'([^']*)')/g)].flatMap((match) =>
    (match[1] ?? match[2] ?? "").split(/\s+/).filter(Boolean),
  );
  const ids = [...html.matchAll(/\bid=(?:"([^"]*)"|'([^']*)')/g)].map(
    (match) => match[1] ?? match[2] ?? "",
  );
  const tags = [...html.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9-]*)/g)].map(
    (match) => match[1]?.toLowerCase() ?? "",
  );
  return {
    classes: classes.filter(Boolean),
    ids: ids.filter(Boolean),
    tags: tags.filter(Boolean),
  };
}

export function countIdentifierUsage(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

export function mergeIdentifierCounts(
  target: Map<string, number>,
  source: Map<string, number>,
): void {
  for (const [key, count] of source) {
    target.set(key, (target.get(key) ?? 0) + count);
  }
}

export function incrementIdentifierCounts(
  target: Map<string, number>,
  identifiers: SelectorIdentifiers,
): void {
  for (const value of identifiers.classes) {
    target.set(value, (target.get(value) ?? 0) + 1);
  }
  for (const value of identifiers.ids) {
    target.set(value, (target.get(value) ?? 0) + 1);
  }
  for (const value of identifiers.tags) {
    target.set(value, (target.get(value) ?? 0) + 1);
  }
}

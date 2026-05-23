import {
  extractMarkupIdentifiers,
  extractSelectorIdentifiers,
  incrementIdentifierCounts,
  parseCssRules,
  serializeCssRules,
  type CssRule,
} from "../parse/css.ts";
import type { ExtractionPlanItem } from "./cross-page.ts";

export type CssSource = {
  publicHref: string;
  content: string;
};

export type ComponentStyleAssignment = {
  componentStyles: Map<string, string>;
  remainingCssByHref: Map<string, string>;
};

const GLOBAL_ONLY_TAGS = new Set(["html", "body"]);

function ruleTargetsComponent(rule: CssRule, item: ExtractionPlanItem): boolean {
  const selectorIds = extractSelectorIdentifiers(rule.selector);
  const markupIds = extractMarkupIdentifiers(item.html);

  if (
    selectorIds.tags.every((tag) => GLOBAL_ONLY_TAGS.has(tag)) &&
    selectorIds.classes.length === 0
  ) {
    return false;
  }

  const referencesRootTag = selectorIds.tags.includes(item.tagName);
  const referencesClass = selectorIds.classes.some((cls) => markupIds.classes.includes(cls));
  const referencesId = selectorIds.ids.some((id) => markupIds.ids.includes(id));

  return referencesRootTag || referencesClass || referencesId;
}

function ruleIsExclusiveToComponent(
  rule: CssRule,
  item: ExtractionPlanItem,
  siteClassCounts: Map<string, number>,
  siteIdCounts: Map<string, number>,
  componentClassCounts: Map<string, number>,
  componentIdCounts: Map<string, number>,
): boolean {
  const selectorIds = extractSelectorIdentifiers(rule.selector);
  const markupIds = extractMarkupIdentifiers(item.html);

  for (const cls of selectorIds.classes) {
    if ((siteClassCounts.get(cls) ?? 0) > (componentClassCounts.get(cls) ?? 0)) {
      return false;
    }
    if (!markupIds.classes.includes(cls)) {
      return false;
    }
  }

  for (const id of selectorIds.ids) {
    if ((siteIdCounts.get(id) ?? 0) > (componentIdCounts.get(id) ?? 0)) {
      return false;
    }
    if (!markupIds.ids.includes(id)) {
      return false;
    }
  }

  if (
    selectorIds.tags.some((tag) => GLOBAL_ONLY_TAGS.has(tag)) &&
    !selectorIds.tags.includes(item.tagName)
  ) {
    return false;
  }

  return ruleTargetsComponent(rule, item);
}

function buildSiteIdentifierCounts(allBodyHtml: string[]): {
  classes: Map<string, number>;
  ids: Map<string, number>;
} {
  const classes = new Map<string, number>();
  const ids = new Map<string, number>();

  for (const bodyHtml of allBodyHtml) {
    const markupIds = extractMarkupIdentifiers(bodyHtml);
    incrementIdentifierCounts(classes, { classes: markupIds.classes, ids: [], tags: [] });
    incrementIdentifierCounts(ids, { classes: [], ids: markupIds.ids, tags: [] });
  }

  return { classes, ids };
}

function buildComponentIdentifierCounts(item: ExtractionPlanItem): {
  classes: Map<string, number>;
  ids: Map<string, number>;
} {
  const classes = new Map<string, number>();
  const ids = new Map<string, number>();
  const markupIds = extractMarkupIdentifiers(item.html);
  incrementIdentifierCounts(classes, { classes: markupIds.classes, ids: [], tags: [] });
  incrementIdentifierCounts(ids, { classes: [], ids: markupIds.ids, tags: [] });
  return { classes, ids };
}

export function assignComponentStyles(
  planItems: ExtractionPlanItem[],
  cssSources: CssSource[],
  allBodyHtml: string[],
): ComponentStyleAssignment {
  const componentStyles = new Map<string, string>();
  const remainingCssByHref = new Map<string, string>();
  const siteCounts = buildSiteIdentifierCounts(allBodyHtml);

  for (const source of cssSources) {
    const rules = parseCssRules(source.content);
    const assignedRuleIndexes = new Set<number>();
    const rulesByComponent = new Map<string, CssRule[]>();

    for (const item of planItems) {
      const componentCounts = buildComponentIdentifierCounts(item);
      const matched: CssRule[] = [];

      for (let index = 0; index < rules.length; index++) {
        if (assignedRuleIndexes.has(index)) {
          continue;
        }
        const rule = rules[index];
        if (!rule) {
          continue;
        }
        if (
          ruleIsExclusiveToComponent(
            rule,
            item,
            siteCounts.classes,
            siteCounts.ids,
            componentCounts.classes,
            componentCounts.ids,
          )
        ) {
          matched.push(rule);
          assignedRuleIndexes.add(index);
        }
      }

      if (matched.length > 0) {
        rulesByComponent.set(item.name, matched);
      }
    }

    for (const item of planItems) {
      const matched = rulesByComponent.get(item.name);
      if (!matched?.length) {
        continue;
      }
      const existing = componentStyles.get(item.name) ?? "";
      const next = serializeCssRules(matched);
      componentStyles.set(item.name, existing ? `${existing}\n\n${next}` : next);
    }

    const remaining = rules.filter((_, index) => !assignedRuleIndexes.has(index));
    remainingCssByHref.set(source.publicHref, serializeCssRules(remaining));
  }

  return { componentStyles, remainingCssByHref };
}

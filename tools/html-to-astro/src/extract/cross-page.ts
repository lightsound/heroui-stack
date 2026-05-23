import { toHtml } from "hast-util-to-html";

import { parseHtmlDocument } from "../parse/html.ts";
import type { ExtractionManifest } from "../types.ts";
import { collectSubtreeCandidates, fingerprintElement } from "./fingerprint.ts";
import {
  analyzePropsFromHtmlInstances,
  componentNameFromElement,
  formatComponentUsage,
  type ComponentProp,
  type PropInstance,
} from "./props.ts";
import type { ExtractOptions } from "./replace.ts";

export type ExtractionPlanItem = {
  name: string;
  fingerprint: string;
  html: string;
  tagName: string;
  props: ComponentProp[];
  templateHtml: string;
  instances: PropInstance[];
};

export type ExtractionPlan = {
  items: ExtractionPlanItem[];
  manifest: ExtractionManifest;
};

type TaggedCandidate = {
  fingerprint: string;
  html: string;
  tagName: string;
  nodeCount: number;
  pageIndex: number;
  node: import("hast").Element;
};

function previewHtml(html: string, maxLength = 400): string {
  const trimmed = html.trim();
  return trimmed.length <= maxLength ? trimmed : `${trimmed.slice(0, maxLength)}…`;
}

function buildPlanItem(
  fingerprint: string,
  name: string,
  sample: TaggedCandidate,
  group: TaggedCandidate[],
): ExtractionPlanItem {
  const uniqueHtml = [...new Set(group.map((item) => item.html))];
  const propsAnalysis = analyzePropsFromHtmlInstances(uniqueHtml);

  return {
    name,
    fingerprint,
    html: propsAnalysis.templateHtml || sample.html,
    tagName: sample.tagName,
    props: propsAnalysis.props,
    templateHtml: propsAnalysis.templateHtml || sample.html,
    instances: propsAnalysis.instances,
  };
}

function confidenceForCrossPageGroup(group: TaggedCandidate[], avgNodes: number): number {
  const uniquePages = new Set(group.map((item) => item.pageIndex)).size;
  const pageScore = Math.min(uniquePages / 2, 1);
  const countScore = Math.min(group.length / 4, 1);
  const sizeScore = Math.min(avgNodes / 10, 1);
  const crossPageBoost = uniquePages >= 2 ? 0.08 : 0;
  return Math.min(
    0.99,
    0.4 + pageScore * 0.3 + countScore * 0.2 + sizeScore * 0.1 + crossPageBoost,
  );
}

export function planCrossPageExtraction(
  pagesBodyHtml: string[],
  options: ExtractOptions,
): ExtractionPlan {
  const manifest: ExtractionManifest = {
    applied: [],
    suggested: [],
    skipped: [],
  };

  if (!options.enabled) {
    return { items: [], manifest };
  }

  const tagged: TaggedCandidate[] = [];

  for (let pageIndex = 0; pageIndex < pagesBodyHtml.length; pageIndex++) {
    const bodyHtml = pagesBodyHtml[pageIndex];
    if (!bodyHtml?.trim()) {
      continue;
    }

    const tree = parseHtmlDocument(`<body>${bodyHtml}</body>`);
    const candidates = collectSubtreeCandidates(tree, {
      minNodes: options.minNodes,
      minChars: options.minChars,
    });

    for (const candidate of candidates) {
      const fingerprint = fingerprintElement(candidate.node, { structural: true });
      tagged.push({
        fingerprint,
        html: toHtml(candidate.node),
        tagName: candidate.tagName,
        nodeCount: candidate.nodeCount,
        pageIndex,
        node: candidate.node,
      });
    }
  }

  const groups = new Map<string, TaggedCandidate[]>();
  for (const candidate of tagged) {
    const list = groups.get(candidate.fingerprint) ?? [];
    list.push(candidate);
    groups.set(candidate.fingerprint, list);
  }

  const applied = new Map<string, ExtractionPlanItem>();
  const nameUsage = new Map<string, number>();

  for (const [fingerprint, group] of groups) {
    if (group.length < 2) {
      continue;
    }

    const sample = group[0];
    if (!sample) {
      continue;
    }

    const avgNodes = group.reduce((sum, item) => sum + item.nodeCount, 0) / group.length;
    const confidence = confidenceForCrossPageGroup(group, avgNodes);
    const baseName = componentNameFromElement(sample.node, fingerprint);
    const usage = nameUsage.get(baseName) ?? 0;
    nameUsage.set(baseName, usage + 1);
    const name = usage === 0 ? baseName : `${baseName}${usage + 1}`;

    const entry = { name, fingerprint, occurrences: group.length, confidence };
    const approved = options.approveFingerprints?.includes(fingerprint) ?? false;

    if (confidence < options.threshold && !approved) {
      const uniqueHtml = [...new Set(group.map((item) => item.html))];
      const propsAnalysis = analyzePropsFromHtmlInstances(uniqueHtml);
      manifest.suggested.push({
        ...entry,
        reason: "below threshold",
        props: propsAnalysis.props.map((prop) => prop.name),
        previewHtml: previewHtml(sample.html),
      });
      continue;
    }

    if (applied.has(fingerprint)) {
      manifest.skipped.push({ fingerprint, reason: "fingerprint collision" });
      continue;
    }

    const planItem = buildPlanItem(fingerprint, name, sample, group);
    applied.set(fingerprint, planItem);
    manifest.applied.push({
      ...entry,
      props: planItem.props.map((prop) => prop.name),
      previewHtml: previewHtml(sample.html),
    });
  }

  const items = Array.from(applied.values()).sort(
    (a: ExtractionPlanItem, b: ExtractionPlanItem) => b.html.length - a.html.length,
  );

  return { items, manifest };
}

export function applyExtractionPlan(
  bodyHtml: string,
  plan: ExtractionPlan,
): { bodyHtml: string; componentImports: string[] } {
  let outputHtml = bodyHtml;
  const componentImports: string[] = [];

  for (const item of plan.items) {
    const replacements =
      item.instances.length > 0 ? item.instances : [{ html: item.html, propValues: {} }];

    for (const instance of replacements) {
      if (!outputHtml.includes(instance.html)) {
        continue;
      }
      const usage = formatComponentUsage(item.name, instance.propValues);
      outputHtml = outputHtml.split(instance.html).join(usage);
      componentImports.push(`import ${item.name} from "../components/${item.name}.astro";`);
    }
  }

  return {
    bodyHtml: outputHtml,
    componentImports: [...new Set(componentImports)],
  };
}

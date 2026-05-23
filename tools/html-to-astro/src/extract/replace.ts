import { emitComponentAstro } from "../transform/astro-emit.ts";
import type { ExtractionManifest } from "../types.ts";
import { applyExtractionPlan, planCrossPageExtraction } from "./cross-page.ts";

export type ExtractOptions = {
  threshold: number;
  enabled: boolean;
  minNodes?: number;
  minChars?: number;
  approveFingerprints?: string[];
};

export type ExtractResult = {
  bodyHtml: string;
  componentImports: string[];
  components: Record<string, string>;
  manifest: ExtractionManifest;
};

export function extractComponents(bodyHtml: string, options: ExtractOptions): ExtractResult {
  const plan = planCrossPageExtraction([bodyHtml], options);
  const applied = applyExtractionPlan(bodyHtml, plan);
  const components: Record<string, string> = {};

  for (const item of plan.items) {
    components[`src/components/${item.name}.astro`] = emitComponentAstro(
      item.templateHtml || item.html,
      undefined,
      item.props,
    );
  }

  return {
    bodyHtml: applied.bodyHtml,
    componentImports: applied.componentImports,
    components,
    manifest: plan.manifest,
  };
}

export function mergeManifests(target: ExtractionManifest, source: ExtractionManifest): void {
  const seenApplied = new Set(target.applied.map((a) => a.fingerprint));
  for (const item of source.applied) {
    if (!seenApplied.has(item.fingerprint)) {
      target.applied.push(item);
      seenApplied.add(item.fingerprint);
    }
  }
  target.suggested.push(...source.suggested);
  target.skipped.push(...source.skipped);
}

export { applyExtractionPlan, planCrossPageExtraction } from "./cross-page.ts";
export type { ExtractionPlan, ExtractionPlanItem } from "./cross-page.ts";

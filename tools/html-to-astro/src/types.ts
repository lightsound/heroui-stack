import type { Root } from "hast";

export type ExcludedItem = {
  path: string;
  reason: string;
  snippet?: string;
};

export type WarningItem = {
  path: string;
  message: string;
};

export type ConversionReport = {
  pages: Array<{ source: string; page: string }>;
  excluded: ExcludedItem[];
  warnings: WarningItem[];
  slugAdjustments: Array<{ source: string; slug: string; reason: string }>;
};

export type ExtractionManifest = {
  applied: Array<{
    name: string;
    fingerprint: string;
    occurrences: number;
    confidence: number;
    props?: string[];
    previewHtml?: string;
  }>;
  suggested: Array<{
    name: string;
    fingerprint: string;
    occurrences: number;
    confidence: number;
    reason: string;
    props?: string[];
    previewHtml?: string;
  }>;
  skipped: Array<{ fingerprint: string; reason: string }>;
};

export type ConvertOptions = {
  input: string;
  output: string;
  extract?: boolean;
  extractThreshold?: number;
  approveFingerprints?: string[];
  dryRun?: boolean;
};

export type ConvertResult = {
  files: Record<string, string>;
  report: ConversionReport;
  extraction: ExtractionManifest;
};

export type ParsedPage = {
  sourcePath: string;
  relativePath: string;
  slug: string;
  astroPagePath: string;
  tree: Root;
  headHtml: string;
  bodyHtml: string;
  title: string;
  stylesheetHrefs: string[];
};

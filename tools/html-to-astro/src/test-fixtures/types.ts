export type FixtureSource =
  | { type: "dir"; path: string }
  | { type: "generated"; recipe: string; options?: Record<string, unknown> }
  | { type: "zip"; recipe: string; options?: Record<string, unknown> };

export type FixtureExpect = {
  pages?: number;
  pagesMin?: number;
  excludedMin?: number;
  excludedReasons?: string[];
  warningsContain?: string[];
  warningsMin?: number;
  publicFiles?: string[];
  outputContains?: string[];
  outputNotContains?: string[];
  slugAdjustmentsMin?: number;
  componentsMin?: number;
  hasIndexPage?: boolean;
};

export type FixtureEntry = {
  id: string;
  description?: string;
  tags: string[];
  smoke?: boolean;
  source: FixtureSource;
  convert?: {
    extract?: boolean;
    extractThreshold?: number;
  };
  expect: FixtureExpect;
};

export type GeneratedSuite = {
  prefix: string;
  recipe: string;
  sourceType?: "generated" | "zip";
  tags: string[];
  smoke?: boolean;
  convert?: FixtureEntry["convert"];
  expect: FixtureExpect;
  variants: Array<Record<string, unknown>>;
};

export type CatalogManifest = {
  fixtures: FixtureEntry[];
  generatedSuites?: GeneratedSuite[];
};

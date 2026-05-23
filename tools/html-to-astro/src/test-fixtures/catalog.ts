import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { generateFixtureDir, generateFixtureZip } from "./recipes.ts";
import type { CatalogManifest, FixtureEntry, GeneratedSuite } from "./types.ts";

const catalogDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../fixtures/catalog",
);

export function getCatalogDir(): string {
  return catalogDir;
}

export function loadCatalogManifest(): CatalogManifest {
  const manifestPath = path.join(catalogDir, "manifest.json");
  return JSON.parse(fs.readFileSync(manifestPath, "utf8")) as CatalogManifest;
}

function expandGeneratedSuite(suite: GeneratedSuite): FixtureEntry[] {
  return suite.variants.map((options, index) => ({
    id: `${suite.prefix}-${String(index + 1).padStart(3, "0")}`,
    description: `${suite.recipe} variant ${index + 1}`,
    tags: suite.tags,
    smoke: suite.smoke,
    source:
      suite.sourceType === "zip"
        ? { type: "zip", recipe: suite.recipe, options }
        : { type: "generated", recipe: suite.recipe, options },
    convert: suite.convert,
    expect: suite.expect,
  }));
}

export function expandCatalogEntries(manifest: CatalogManifest): FixtureEntry[] {
  const generated = (manifest.generatedSuites ?? []).flatMap(expandGeneratedSuite);
  return [...manifest.fixtures, ...generated];
}

export type ResolvedFixtureInput = {
  inputPath: string;
  cleanup: () => void;
};

export function resolveFixtureInput(entry: FixtureEntry, tempRoot: string): ResolvedFixtureInput {
  const source = entry.source;

  if (source.type === "dir") {
    const inputPath = path.resolve(catalogDir, source.path);
    return { inputPath, cleanup: () => {} };
  }

  if (source.type === "generated") {
    const inputPath = path.join(tempRoot, "input");
    generateFixtureDir(source.recipe, source.options ?? {}, inputPath);
    return {
      inputPath,
      cleanup: () => fs.rmSync(tempRoot, { recursive: true, force: true }),
    };
  }

  const zipPath = path.join(tempRoot, "input.zip");
  generateFixtureZip(source.recipe, source.options ?? {}, zipPath, tempRoot);
  return {
    inputPath: zipPath,
    cleanup: () => fs.rmSync(tempRoot, { recursive: true, force: true }),
  };
}

export function filterCatalogEntries(
  entries: FixtureEntry[],
  filterPattern?: string,
): FixtureEntry[] {
  if (!filterPattern) {
    return entries;
  }
  const re = new RegExp(filterPattern);
  return entries.filter((entry) => re.test(entry.id) || entry.tags.some((tag) => re.test(tag)));
}

export function getSmokeEntries(entries: FixtureEntry[]): FixtureEntry[] {
  return entries.filter((entry) => entry.smoke);
}

export function createFixtureTempRoot(entryId: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `html-to-astro-catalog-${entryId}-`));
}

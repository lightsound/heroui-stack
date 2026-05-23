import fs from "node:fs";
import path from "node:path";

import { expect } from "vite-plus/test";

import type { ConvertResult } from "../types.ts";
import { validateAstroSource } from "../validate/compiler.ts";
import type { FixtureExpect } from "./types.ts";

export async function assertFixtureExpectations(
  outputDir: string,
  result: ConvertResult,
  expectSpec: FixtureExpect,
): Promise<void> {
  if (expectSpec.hasIndexPage !== false) {
    expect(fs.existsSync(path.join(outputDir, "src/pages/index.astro"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "astro.config.mjs"))).toBe(true);
  }

  if (expectSpec.pages !== undefined) {
    expect(result.report.pages).toHaveLength(expectSpec.pages);
  }
  if (expectSpec.pagesMin !== undefined) {
    expect(result.report.pages.length).toBeGreaterThanOrEqual(expectSpec.pagesMin);
  }
  if (expectSpec.excludedMin !== undefined) {
    expect(result.report.excluded.length).toBeGreaterThanOrEqual(expectSpec.excludedMin);
  }
  if (expectSpec.excludedReasons?.length) {
    const reasons = result.report.excluded
      .map((item) => item.reason)
      .join("\n")
      .toLowerCase();
    for (const pattern of expectSpec.excludedReasons) {
      expect(reasons).toContain(pattern.toLowerCase());
    }
  }
  if (expectSpec.warningsMin !== undefined) {
    expect(result.report.warnings.length).toBeGreaterThanOrEqual(expectSpec.warningsMin);
  }
  if (expectSpec.warningsContain?.length) {
    const messages = result.report.warnings
      .map((item) => item.message)
      .join("\n")
      .toLowerCase();
    for (const pattern of expectSpec.warningsContain) {
      expect(messages).toContain(pattern.toLowerCase());
    }
  }
  if (expectSpec.slugAdjustmentsMin !== undefined) {
    expect(result.report.slugAdjustments.length).toBeGreaterThanOrEqual(
      expectSpec.slugAdjustmentsMin,
    );
  }
  if (expectSpec.componentsMin !== undefined) {
    const componentsDir = path.join(outputDir, "src/components");
    const count = fs.existsSync(componentsDir) ? fs.readdirSync(componentsDir).length : 0;
    expect(count).toBeGreaterThanOrEqual(expectSpec.componentsMin);
  }
  if (expectSpec.publicFiles?.length) {
    for (const publicFile of expectSpec.publicFiles) {
      expect(fs.existsSync(path.join(outputDir, "public", publicFile))).toBe(true);
    }
  }

  const pagesDir = path.join(outputDir, "src/pages");
  if (fs.existsSync(pagesDir)) {
    const pageFiles = fs.readdirSync(pagesDir).filter((file) => file.endsWith(".astro"));
    const allPageContent: string[] = [];

    for (const pageFile of pageFiles) {
      const content = fs.readFileSync(path.join(pagesDir, pageFile), "utf8");
      allPageContent.push(content);
      const validation = await validateAstroSource(content, pageFile);
      expect(validation.ok, validation.ok ? undefined : validation.error).toBe(true);
      expect(content).not.toMatch(/client:/);
    }

    const combined = allPageContent.join("\n");
    const layoutPath = path.join(outputDir, "src/layouts/BaseLayout.astro");
    const layoutContent = fs.existsSync(layoutPath) ? fs.readFileSync(layoutPath, "utf8") : "";
    const combinedOutput = `${combined}\n${layoutContent}`;
    if (expectSpec.outputContains?.length) {
      for (const snippet of expectSpec.outputContains) {
        expect(combinedOutput).toContain(snippet);
      }
    }
    if (expectSpec.outputNotContains?.length) {
      for (const snippet of expectSpec.outputNotContains) {
        expect(combinedOutput).not.toContain(snippet);
      }
    }
  }
}

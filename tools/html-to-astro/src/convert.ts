import fs from "node:fs";
import path from "node:path";

import { assignComponentStyles } from "./extract/css-scope.ts";
import { applyExtractionPlan, planCrossPageExtraction } from "./extract/replace.ts";
import { findHtmlFiles, ingestInput } from "./ingest/index.ts";
import { ingestAssetFile, processCssFileAssets } from "./parse/assets.ts";
import { parseHtmlDocument } from "./parse/html.ts";
import { rewriteAssetUrlsInTree } from "./parse/rewrite-assets.ts";
import { stripAstroUnsafeControls } from "./sanitize.ts";
import { assignSlugs } from "./slug.ts";
import {
  emitAstroConfig,
  emitBaseLayout,
  emitComponentAstro,
  emitPageAstro,
  emitProjectPackageJson,
  emitReadme,
  emitWranglerConfig,
} from "./transform/astro-emit.ts";
import { splitHtmlPage } from "./transform/layout.ts";
import type {
  ConvertOptions,
  ConvertResult,
  ConversionReport,
  ExtractionManifest,
} from "./types.ts";
import { validateAstroSource } from "./validate/compiler.ts";

type PreparedPage = {
  rel: string;
  assignment: ReturnType<typeof assignSlugs>[number];
  split: ReturnType<typeof splitHtmlPage>;
  bodyHtml: string;
};

type CssSource = {
  publicHref: string;
  content: string;
  sourcePath: string;
};

export async function convert(options: ConvertOptions): Promise<ConvertResult> {
  const {
    input,
    output,
    extract = false,
    extractThreshold = 0.85,
    approveFingerprints,
    dryRun = false,
  } = options;
  const ingested = ingestInput(input);

  try {
    const htmlFiles = findHtmlFiles(ingested.rootDir);
    if (htmlFiles.length === 0) {
      throw new Error("No HTML files found in input");
    }

    const relativePaths = htmlFiles.map((f) =>
      path.relative(ingested.rootDir, f).replace(/\\/g, "/"),
    );
    const slugAssignments = assignSlugs(relativePaths);
    const slugByRel = new Map(slugAssignments.map((s) => [s.relativePath, s]));

    const report: ConversionReport = {
      pages: [],
      excluded: [],
      warnings: [],
      slugAdjustments: [],
    };

    const extraction: ExtractionManifest = {
      applied: [],
      suggested: [],
      skipped: [],
    };

    const files: Record<string, string> = {};
    const globalStylesheets = new Set<string>();
    const cssSources = new Map<string, CssSource>();
    let siteTitle = "Converted site";

    const publicDir = path.join(output, "public");
    if (!dryRun) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    const preparedPages: PreparedPage[] = [];

    for (const htmlPath of htmlFiles) {
      const rel = path.relative(ingested.rootDir, htmlPath).replace(/\\/g, "/");
      const assignment = slugByRel.get(rel);
      if (!assignment) {
        continue;
      }

      if (assignment.adjustment) {
        report.slugAdjustments.push({
          source: rel,
          slug: assignment.slug,
          reason: assignment.adjustment,
        });
      }

      const source = fs.readFileSync(htmlPath, "utf8");
      const split = splitHtmlPage(source, rel, report.excluded);
      if (stripAstroUnsafeControls(source) !== source) {
        report.warnings.push({
          path: rel,
          message:
            "Removed invisible control characters from HTML (they break Astro compiler validation)",
        });
      }
      split.headHtml = stripAstroUnsafeControls(split.headHtml);
      split.bodyHtml = stripAstroUnsafeControls(split.bodyHtml);
      report.warnings.push(...split.warnings);

      for (const href of split.stylesheetHrefs) {
        const resolved = path.resolve(ingested.rootDir, href.replace(/^\//, ""));
        const publicHref = ingestAssetFile(ingested.rootDir, href, publicDir, rel, report.excluded);
        if (publicHref) {
          globalStylesheets.add(publicHref);
          if (resolved.endsWith(".css") && fs.existsSync(resolved)) {
            if (!dryRun) {
              processCssFileAssets(ingested.rootDir, resolved, publicDir, report.excluded);
            }
            cssSources.set(resolved, {
              publicHref,
              content: fs.readFileSync(resolved, "utf8"),
              sourcePath: resolved,
            });
          }
        } else if (href.startsWith("http")) {
          globalStylesheets.add(href);
        }
      }

      if (split.title) {
        siteTitle = split.title;
      }

      const bodyTree = parseHtmlDocument(`<body>${split.bodyHtml}</body>`);
      const bodyHtml = rewriteAssetUrlsInTree(
        bodyTree,
        ingested.rootDir,
        publicDir,
        rel,
        report.excluded,
      )
        .replace(/^<body>|<\/body>$/gi, "")
        .trim();

      preparedPages.push({ rel, assignment, split, bodyHtml });
    }

    const extractionPlan = planCrossPageExtraction(
      preparedPages.map((page) => page.bodyHtml),
      {
        enabled: extract,
        threshold: extractThreshold,
        approveFingerprints,
      },
    );

    extraction.applied.push(...extractionPlan.manifest.applied);
    extraction.suggested.push(...extractionPlan.manifest.suggested);
    extraction.skipped.push(...extractionPlan.manifest.skipped);

    const styleAssignment =
      extract && extractionPlan.items.length > 0
        ? assignComponentStyles(
            extractionPlan.items,
            [...cssSources.values()].map(({ publicHref, content }) => ({ publicHref, content })),
            preparedPages.map((page) => page.bodyHtml),
          )
        : null;

    if (styleAssignment) {
      for (const [publicHref, content] of styleAssignment.remainingCssByHref) {
        if (!dryRun && content.trim()) {
          const dest = path.join(publicDir, publicHref.replace(/^\//, ""));
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.writeFileSync(dest, `${content.trim()}\n`, "utf8");
        }
      }
    }

    for (const item of extractionPlan.items) {
      const scopedCss = styleAssignment?.componentStyles.get(item.name);
      files[`src/components/${item.name}.astro`] = emitComponentAstro(
        item.templateHtml || item.html,
        scopedCss,
        item.props,
      );
    }

    for (const page of preparedPages) {
      let bodyHtml = page.bodyHtml;
      let pageImports: string[] = [];

      if (extract && extractionPlan.items.length > 0) {
        const applied = applyExtractionPlan(bodyHtml, extractionPlan);
        bodyHtml = applied.bodyHtml;
        pageImports = applied.componentImports;
      }

      const pageContent = emitPageAstro(bodyHtml, page.split.headHtml, {
        title: page.split.title,
        imports: pageImports,
      });

      files[page.assignment.astroPagePath] = pageContent;
      report.pages.push({ source: page.rel, page: page.assignment.astroPagePath });
    }

    files["src/layouts/BaseLayout.astro"] = emitBaseLayout(siteTitle, "", [...globalStylesheets]);
    files["astro.config.mjs"] = emitAstroConfig();
    files["package.json"] = emitProjectPackageJson();
    files["wrangler.jsonc"] = emitWranglerConfig();
    files["README.md"] = emitReadme();
    files[".conversion/report.json"] = JSON.stringify(report, null, 2);
    files[".conversion/extraction-manifest.json"] = JSON.stringify(extraction, null, 2);

    const astroEntries = Object.entries(files).filter(([filePath]) => filePath.endsWith(".astro"));
    const validationResults = await Promise.all(
      astroEntries.map(async ([filePath, content]) => validateAstroSource(content, filePath)),
    );
    const validationErrors = validationResults
      .filter((result): result is { ok: false; error: string } => !result.ok)
      .map((result) => result.error);

    if (validationErrors.length > 0) {
      throw new Error(`Astro validation failed:\n${validationErrors.join("\n")}`);
    }

    if (!dryRun) {
      for (const [filePath, content] of Object.entries(files)) {
        const dest = path.join(output, filePath);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, content, "utf8");
      }
    }

    return { files, report, extraction };
  } finally {
    ingested.cleanup?.();
  }
}

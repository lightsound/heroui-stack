import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

import { convert } from "./src/convert.ts";
import { assignSlugs } from "./src/slug.ts";
import { validateAstroSource } from "./src/validate/compiler.ts";
import { checkWorkersCompatible } from "./src/validate/workers-compat.ts";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

test("assignSlugs maps index and about paths", () => {
  const slugs = assignSlugs(["index.html", "about.html", "blog/post.html", "blog/index.html"]);
  expect(slugs.find((s) => s.relativePath === "index.html")?.slug).toBe("index");
  expect(slugs.find((s) => s.relativePath === "about.html")?.slug).toBe("about");
  expect(slugs.find((s) => s.relativePath === "blog/post.html")?.astroPagePath).toBe(
    "src/pages/blog-post.astro",
  );
  expect(slugs.find((s) => s.relativePath === "blog/index.html")?.slug).toBe("blog-index");
});

test("checkWorkersCompatible rejects Node APIs", () => {
  expect(checkWorkersCompatible("const fs = require('fs')").compatible).toBe(false);
  expect(checkWorkersCompatible("document.querySelector('a')").compatible).toBe(true);
});

test("convert simple fixture to Astro project", async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "html-to-astro-test-"));
  const result = await convert({
    input: path.join(fixturesDir, "simple"),
    output: out,
  });

  expect(result.report.pages).toHaveLength(1);
  expect(result.report.pages[0]?.page).toBe("src/pages/index.astro");
  expect(fs.existsSync(path.join(out, "src/pages/index.astro"))).toBe(true);
  expect(fs.existsSync(path.join(out, "astro.config.mjs"))).toBe(true);
  expect(fs.readFileSync(path.join(out, "astro.config.mjs"), "utf8")).toContain("cloudflare");
  expect(fs.readFileSync(path.join(out, "package.json"), "utf8")).toContain("6.3.7");

  const page = fs.readFileSync(path.join(out, "src/pages/index.astro"), "utf8");
  const validation = await validateAstroSource(page, "index.astro");
  expect(validation.ok).toBe(true);
  expect(page).toContain("BaseLayout");
  expect(page).toContain("Hello");
});

test("convert multi-page fixture", async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "html-to-astro-multi-"));
  const result = await convert({
    input: path.join(fixturesDir, "multi"),
    output: out,
  });

  expect(result.report.pages).toHaveLength(2);
  expect(fs.existsSync(path.join(out, "src/pages/index.astro"))).toBe(true);
  expect(fs.existsSync(path.join(out, "src/pages/about.astro"))).toBe(true);
});

test("convert with component extraction", async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "html-to-astro-extract-"));
  const result = await convert({
    input: path.join(fixturesDir, "extract"),
    output: out,
    extract: true,
    extractThreshold: 0.5,
  });

  expect(result.extraction.applied.length).toBeGreaterThan(0);
  const componentFiles = fs.readdirSync(path.join(out, "src/components"));
  expect(componentFiles.length).toBeGreaterThan(0);
});

test("excludes Workers-incompatible inline script", async () => {
  const tmpIn = fs.mkdtempSync(path.join(os.tmpdir(), "html-to-astro-bad-"));
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "html-to-astro-bad-out-"));
  fs.writeFileSync(
    path.join(tmpIn, "index.html"),
    `<!DOCTYPE html><html><head><title>T</title></head><body><script>require('fs')</script><p>ok</p></body></html>`,
  );

  const result = await convert({ input: tmpIn, output: out });
  expect(result.report.excluded.length).toBeGreaterThan(0);
  const page = fs.readFileSync(path.join(out, "src/pages/index.astro"), "utf8");
  expect(page).not.toContain("require('fs')");
  expect(page).toContain("ok");
});

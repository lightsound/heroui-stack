import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

import { convert } from "./src/convert.ts";
import { planCrossPageExtraction } from "./src/extract/replace.ts";
import { parseCssRules } from "./src/parse/css.ts";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

test("planCrossPageExtraction finds shared nav across pages", () => {
  const nav = `<nav><a href="index.html">Home</a><a href="about.html">About</a></nav>`;
  const plan = planCrossPageExtraction(
    [`<main>${nav}<h1>Home</h1></main>`, `<main>${nav}<h1>About</h1></main>`],
    { enabled: true, threshold: 0.85 },
  );

  expect(plan.items.some((item) => item.name === "Nav")).toBe(true);
  expect(plan.manifest.applied.some((item) => item.name === "Nav")).toBe(true);
});

test("convert realistic with extract creates Nav component and scoped CSS", async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "html-to-astro-realistic-extract-"));
  const result = await convert({
    input: path.join(fixturesDir, "realistic"),
    output: out,
    extract: true,
    extractThreshold: 0.85,
  });

  expect(result.extraction.applied.some((item) => item.name === "Nav")).toBe(true);
  expect(fs.existsSync(path.join(out, "src/components/Nav.astro"))).toBe(true);

  const navComponent = fs.readFileSync(path.join(out, "src/components/Nav.astro"), "utf8");
  expect(navComponent).toContain("<nav");
  expect(navComponent).toContain("<style>");
  expect(navComponent).toContain("nav a");

  const indexPage = fs.readFileSync(path.join(out, "src/pages/index.astro"), "utf8");
  expect(indexPage).toContain("<Nav />");
  expect(indexPage).not.toContain('<nav><a href="/index.html">');

  const globalCss = fs.readFileSync(path.join(out, "public/styles.css"), "utf8");
  const rules = parseCssRules(globalCss);
  expect(rules.some((rule) => rule.selector.includes("nav"))).toBe(false);
  expect(rules.some((rule) => rule.selector.includes("body"))).toBe(true);
});

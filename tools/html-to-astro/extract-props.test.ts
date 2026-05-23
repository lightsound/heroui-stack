import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "vite-plus/test";

import { convert } from "./src/convert.ts";
import { analyzePropsFromHtmlInstances } from "./src/extract/props.ts";
import { planCrossPageExtraction } from "./src/extract/replace.ts";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

test("analyzePropsFromHtmlInstances detects varying card text", () => {
  const analysis = analyzePropsFromHtmlInstances([
    '<div class="card"><h2>A</h2><p>One</p></div>',
    '<div class="card"><h2>B</h2><p>Two</p></div>',
    '<div class="card"><h2>C</h2><p>Three</p></div>',
  ]);

  expect(analysis.props.map((prop) => prop.name)).toEqual(["title", "description"]);
  expect(analysis.templateHtml).toContain("{title}");
  expect(analysis.templateHtml).toContain("{description}");
  expect(analysis.instances[0]?.propValues).toEqual({ title: "A", description: "One" });
});

test("convert extract fixture emits Card component with props", async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "html-to-astro-props-"));
  const result = await convert({
    input: path.join(fixturesDir, "extract"),
    output: out,
    extract: true,
    extractThreshold: 0.5,
  });

  expect(result.extraction.applied.some((item) => item.name === "Card")).toBe(true);
  expect(result.extraction.applied.find((item) => item.name === "Card")?.props).toEqual([
    "title",
    "description",
  ]);

  const cardComponent = fs.readFileSync(path.join(out, "src/components/Card.astro"), "utf8");
  expect(cardComponent).toContain("interface Props");
  expect(cardComponent).toContain("{title}");
  expect(cardComponent).toContain("{description}");

  const indexPage = fs.readFileSync(path.join(out, "src/pages/index.astro"), "utf8");
  expect(indexPage).toContain('<Card title={"A"} description={"One"} />');
  expect(indexPage).toContain('<Card title={"C"} description={"Three"} />');
  expect(indexPage).not.toContain("<h2>A</h2>");
});

test("shared nav without varying text stays prop-less", () => {
  const nav = `<nav><a href="index.html">Home</a><a href="about.html">About</a></nav>`;
  const plan = planCrossPageExtraction(
    [`<main>${nav}<h1>Home</h1></main>`, `<main>${nav}<h1>About</h1></main>`],
    { enabled: true, threshold: 0.85 },
  );

  const navItem = plan.items.find((item) => item.name === "Nav");
  expect(navItem?.props).toEqual([]);
  expect(navItem?.instances[0]?.propValues).toEqual({});
});

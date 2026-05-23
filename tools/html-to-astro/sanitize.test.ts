import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { expect, test } from "vite-plus/test";

import { convert } from "./src/convert.ts";
import { stripAstroUnsafeControls } from "./src/sanitize.ts";

test("stripAstroUnsafeControls removes C0 control characters", () => {
  expect(stripAstroUnsafeControls("a\u0001b\u0008c")).toBe("abc");
  expect(stripAstroUnsafeControls("line\nbreak\tok")).toBe("line\nbreak\tok");
});

test("convert tolerates invisible control characters in HTML", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "html-to-astro-control-"));
  let html = fs.readFileSync(
    path.join("tools/html-to-astro/fixtures/realistic/index.html"),
    "utf8",
  );
  html = html.replace("<head>", "<head>\u0001");
  fs.writeFileSync(path.join(dir, "index.html"), html);
  fs.writeFileSync(
    path.join(dir, "about.html"),
    fs.readFileSync(path.join("tools/html-to-astro/fixtures/realistic/about.html"), "utf8"),
  );

  const out = fs.mkdtempSync(path.join(os.tmpdir(), "html-to-astro-control-out-"));
  const result = await convert({
    input: dir,
    output: out,
    extract: true,
    dryRun: true,
  });

  expect(result.report.warnings.some((w) => w.message.includes("control characters"))).toBe(true);
});

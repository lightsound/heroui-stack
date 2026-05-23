import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { expect, test } from "vite-plus/test";

import { convert } from "./src/convert.ts";
import { assertFixtureExpectations } from "./src/test-fixtures/assert-expectations.ts";
import {
  createFixtureTempRoot,
  expandCatalogEntries,
  filterCatalogEntries,
  loadCatalogManifest,
  resolveFixtureInput,
} from "./src/test-fixtures/catalog.ts";

const catalogFilter = process.env.HTML_TO_ASTRO_CATALOG_FILTER;
const catalogEntries = filterCatalogEntries(
  expandCatalogEntries(loadCatalogManifest()),
  catalogFilter,
);

test("catalog manifest expands to 100 fixture entries", () => {
  expect(expandCatalogEntries(loadCatalogManifest())).toHaveLength(100);
});

for (const entry of catalogEntries) {
  test(`catalog: ${entry.id}`, async () => {
    const tempRoot = createFixtureTempRoot(entry.id);
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), `html-to-astro-out-${entry.id}-`));

    try {
      const { inputPath } = resolveFixtureInput(entry, tempRoot);
      const result = await convert({
        input: inputPath,
        output: outputDir,
        extract: entry.convert?.extract,
        extractThreshold: entry.convert?.extractThreshold,
      });

      await assertFixtureExpectations(outputDir, result, entry.expect);
    } finally {
      fs.rmSync(outputDir, { recursive: true, force: true });
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
}

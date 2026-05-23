import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { expect, test } from "vite-plus/test";

import { convert } from "./src/convert.ts";
import {
  createFixtureTempRoot,
  expandCatalogEntries,
  filterCatalogEntries,
  getSmokeEntries,
  loadCatalogManifest,
  resolveFixtureInput,
} from "./src/test-fixtures/catalog.ts";

const smokeEnabled = process.env.HTML_TO_ASTRO_SMOKE_BUILD === "1";
const catalogFilter = process.env.HTML_TO_ASTRO_CATALOG_FILTER;
const smokeEntries = filterCatalogEntries(
  getSmokeEntries(expandCatalogEntries(loadCatalogManifest())),
  catalogFilter,
);

function formatExecError(error: unknown): string {
  if (!(error instanceof Error) || !("stdout" in error) || !("stderr" in error)) {
    return error instanceof Error ? error.message : String(error);
  }

  const stdout = String((error as NodeJS.ErrnoException & { stdout?: string }).stdout ?? "");
  const stderr = String((error as NodeJS.ErrnoException & { stderr?: string }).stderr ?? "");
  return [error.message, stdout && `stdout:\n${stdout}`, stderr && `stderr:\n${stderr}`]
    .filter(Boolean)
    .join("\n\n");
}

async function runCatalogEntryBuild(entryId: string): Promise<void> {
  const manifest = loadCatalogManifest();
  const entry = expandCatalogEntries(manifest).find((item) => item.id === entryId);
  if (!entry) {
    throw new Error(`Catalog entry not found: ${entryId}`);
  }

  const tempRoot = createFixtureTempRoot(entry.id);
  const out = fs.mkdtempSync(path.join(os.tmpdir(), `html-to-astro-smoke-${entry.id}-`));

  try {
    const { inputPath } = resolveFixtureInput(entry, tempRoot);
    await convert({
      input: inputPath,
      output: out,
      extract: entry.convert?.extract,
      extractThreshold: entry.convert?.extractThreshold,
    });

    execSync("pnpm install --config.dangerouslyAllowAllBuilds=true", {
      cwd: out,
      encoding: "utf8",
      stdio: "pipe",
      timeout: 120_000,
    });
    execSync("pnpm build", {
      cwd: out,
      encoding: "utf8",
      stdio: "pipe",
      timeout: 120_000,
    });
  } catch (error) {
    throw new Error(formatExecError(error));
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

for (const entry of smokeEntries) {
  test.skipIf(!smokeEnabled)(
    `astro build smoke: ${entry.id}`,
    async () => {
      await expect(runCatalogEntryBuild(entry.id)).resolves.toBeUndefined();
    },
    300_000,
  );
}

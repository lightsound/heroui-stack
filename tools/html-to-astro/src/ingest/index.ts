import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import AdmZip from "adm-zip";

export type IngestResult = {
  rootDir: string;
  cleanup?: () => void;
};

export function ingestInput(inputPath: string): IngestResult {
  const resolved = path.resolve(inputPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Input not found: ${resolved}`);
  }

  const stat = fs.statSync(resolved);
  if (stat.isDirectory()) {
    return { rootDir: resolved };
  }

  if (resolved.toLowerCase().endsWith(".zip")) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "html-to-astro-"));
    const zip = new AdmZip(resolved);
    zip.extractAllTo(tempDir, true);
    return {
      rootDir: tempDir,
      cleanup: () => fs.rmSync(tempDir, { recursive: true, force: true }),
    };
  }

  throw new Error(`Unsupported input: ${resolved} (expected directory or .zip)`);
}

export function findHtmlFiles(rootDir: string): string[] {
  const entries: string[] = [];

  function walk(dir: string) {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (/\.html?$/i.test(name)) {
        entries.push(full);
      }
    }
  }

  walk(rootDir);
  return entries.sort();
}

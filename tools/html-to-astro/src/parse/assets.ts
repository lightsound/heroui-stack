import fs from "node:fs";
import path from "node:path";

import type { ConversionReport, ExcludedItem } from "../types.ts";
import { checkWorkersCompatible, snippetPreview } from "../validate/workers-compat.ts";

export function resolvePublicAsset(rootDir: string, href: string): string | null {
  if (!href || href.startsWith("http://") || href.startsWith("https://") || href.startsWith("//")) {
    return null;
  }
  const cleaned = href.split("?")[0]?.split("#")[0] ?? href;
  const resolved = path.resolve(rootDir, cleaned.replace(/^\//, ""));
  if (
    !resolved.startsWith(rootDir) ||
    !fs.existsSync(resolved) ||
    !fs.statSync(resolved).isFile()
  ) {
    return null;
  }
  return resolved;
}

export function copyToPublic(
  sourceFile: string,
  publicDir: string,
  relativeFromRoot: string,
): string {
  const publicPath = relativeFromRoot.replace(/\\/g, "/").replace(/^\//, "");
  const dest = path.join(publicDir, publicPath);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(sourceFile, dest);
  return `/${publicPath}`;
}

export function ingestAssetFile(
  rootDir: string,
  href: string,
  publicDir: string,
  reportPath: string,
  excluded: ExcludedItem[],
): string | null {
  const resolved = resolvePublicAsset(rootDir, href);
  if (!resolved) {
    return href.startsWith("http") ? href : null;
  }

  const rel = path.relative(rootDir, resolved).replace(/\\/g, "/");
  if (resolved.endsWith(".js") || resolved.endsWith(".mjs") || resolved.endsWith(".cjs")) {
    const content = fs.readFileSync(resolved, "utf8");
    const check = checkWorkersCompatible(content);
    if (!check.compatible) {
      excluded.push({
        path: reportPath,
        reason: check.reason ?? "Workers incompatible script",
        snippet: snippetPreview(content),
      });
      return null;
    }
  }

  return copyToPublic(resolved, publicDir, rel);
}

export function extractCssUrls(css: string): string[] {
  const urls: string[] = [];
  const re = /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(css)) !== null) {
    const url = match[1]?.trim();
    if (url && !url.startsWith("data:")) {
      urls.push(url);
    }
  }
  return urls;
}

export function processCssFileAssets(
  rootDir: string,
  cssPath: string,
  publicDir: string,
  excluded: ExcludedItem[],
): void {
  const content = fs.readFileSync(cssPath, "utf8");
  const cssDir = path.dirname(cssPath);
  for (const url of extractCssUrls(content)) {
    const assetPath = path.resolve(cssDir, url);
    if (fs.existsSync(assetPath) && fs.statSync(assetPath).isFile()) {
      const rel = path.relative(rootDir, assetPath).replace(/\\/g, "/");
      copyToPublic(assetPath, publicDir, rel);
    } else if (!url.startsWith("http")) {
      excluded.push({
        path: cssPath,
        reason: `Unresolved CSS url(): ${url}`,
      });
    }
  }
}

export type AssetContext = {
  rootDir: string;
  publicDir: string;
  excluded: ExcludedItem[];
  warnings: ConversionReport["warnings"];
  globalStylesheets: string[];
};

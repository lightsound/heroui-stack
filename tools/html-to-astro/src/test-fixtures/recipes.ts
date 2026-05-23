import fs from "node:fs";
import path from "node:path";

import AdmZip from "adm-zip";

const MINIMAL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function writeHtml(dir: string, relativePath: string, body: string, head = ""): void {
  const filePath = path.join(dir, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />${head}<title>${path.basename(relativePath, ".html")}</title></head><body>${body}</body></html>`,
    "utf8",
  );
}

function sharedNav(pages: string[], current: string): string {
  const links = pages.map((page) => `<a href="${page}">${page.replace(".html", "")}</a>`).join("");
  return `<nav data-current="${current}">${links}</nav>`;
}

function recipeSingleHtml(dir: string): void {
  writeHtml(dir, "index.html", "<main><h1>HTML only</h1></main>");
}

function recipeHtmlCss(dir: string): void {
  fs.writeFileSync(
    path.join(dir, "styles.css"),
    "body { font-family: system-ui; margin: 2rem; }\n",
    "utf8",
  );
  writeHtml(
    dir,
    "index.html",
    "<main><h1>Styled</h1></main>",
    '<link rel="stylesheet" href="styles.css" />',
  );
}

function recipeHtmlCssJs(dir: string, options: Record<string, unknown>): void {
  const badScript = options.badScript === true;
  fs.mkdirSync(path.join(dir, "scripts"), { recursive: true });
  fs.writeFileSync(path.join(dir, "styles.css"), "body { margin: 1rem; }\n", "utf8");
  fs.writeFileSync(
    path.join(dir, "scripts/app.js"),
    "document.querySelector('h1')?.classList.add('ready');\n",
    "utf8",
  );
  if (badScript) {
    fs.writeFileSync(path.join(dir, "scripts/bad.js"), "const fs = require('fs');\n", "utf8");
  }
  const scripts = badScript
    ? '<script src="scripts/app.js"></script><script src="scripts/bad.js"></script>'
    : '<script src="scripts/app.js"></script>';
  writeHtml(
    dir,
    "index.html",
    `<main><h1>App</h1>${scripts}</main>`,
    '<link rel="stylesheet" href="styles.css" />',
  );
}

function recipeMultiPage(dir: string, options: Record<string, unknown>): void {
  const count = Number(options.count ?? 2);
  const pages = Array.from({ length: count }, (_, index) =>
    index === 0 ? "index.html" : `page-${index}.html`,
  );
  for (const page of pages) {
    writeHtml(dir, page, `${sharedNav(pages, page)}<main><h1>${page}</h1></main>`);
  }
}

function recipeNestedPath(dir: string, options: Record<string, unknown>): void {
  const relativePath = String(options.path ?? "blog/post.html");
  writeHtml(dir, "index.html", "<main><h1>Home</h1></main>");
  writeHtml(dir, relativePath, `<main><h1>${relativePath}</h1></main>`);
}

function recipeWorkersBad(dir: string, options: Record<string, unknown>): void {
  const pattern = String(options.pattern ?? "require");
  const snippets: Record<string, string> = {
    require: "<script>require('fs')</script>",
    process: "<script>process.exit(1)</script>",
    dirname: "<script>console.log(__dirname)</script>",
    nodeImport: "<script type='module'>import 'node:fs'</script>",
    external: '<script src="scripts/bad.js"></script>',
  };
  if (pattern === "external") {
    fs.mkdirSync(path.join(dir, "scripts"), { recursive: true });
    fs.writeFileSync(path.join(dir, "scripts/bad.js"), "require('fs');\n", "utf8");
  }
  writeHtml(dir, "index.html", `<main>${snippets[pattern] ?? snippets.require}<p>ok</p></main>`);
}

function recipeInteraction(dir: string, options: Record<string, unknown>): void {
  const attr = String(options.attr ?? "onclick");
  writeHtml(
    dir,
    "index.html",
    `<main><button type="button" ${attr}="alert('x')">Go</button></main>`,
  );
}

function recipeUnsupported(dir: string, options: Record<string, unknown>): void {
  const kind = String(options.kind ?? "iframe");
  const body =
    kind === "iframe"
      ? '<iframe src="https://example.com"></iframe>'
      : kind === "template"
        ? "<template><p>tpl</p></template>"
        : "<my-widget>wc</my-widget>";
  writeHtml(dir, "index.html", `<main>${body}</main>`);
}

function recipeCssUrl(dir: string, options: Record<string, unknown>): void {
  const assetPath = String(options.assetPath ?? "images/dot.png");
  fs.mkdirSync(path.dirname(path.join(dir, assetPath)), { recursive: true });
  fs.writeFileSync(path.join(dir, assetPath), MINIMAL_PNG);
  fs.writeFileSync(
    path.join(dir, "styles.css"),
    `body { background-image: url("./${assetPath}"); }\n`,
    "utf8",
  );
  writeHtml(
    dir,
    "index.html",
    "<main><h1>Bg</h1></main>",
    '<link rel="stylesheet" href="styles.css" />',
  );
}

function recipeExtractCards(dir: string, options: Record<string, unknown>): void {
  const cards = Number(options.cards ?? 3);
  const cardHtml = Array.from(
    { length: cards },
    (_, index) => `<div class="card"><h2>Card ${index + 1}</h2><p>Body ${index + 1}</p></div>`,
  ).join("");
  writeHtml(dir, "index.html", `<main>${cardHtml}</main>`);
}

function recipeSlugCollision(dir: string, options: Record<string, unknown>): void {
  const scenario = String(options.scenario ?? "blog-index");
  if (scenario === "blog-index") {
    writeHtml(dir, "blog/index.html", "<main><h1>Blog index</h1></main>");
    writeHtml(dir, "blog/post.html", "<main><h1>Post</h1></main>");
    return;
  }
  if (scenario === "api-reserved") {
    writeHtml(dir, "index.html", "<main><h1>Root</h1></main>");
    writeHtml(dir, "api.html", "<main><h1>API page</h1></main>");
    return;
  }
  writeHtml(dir, "index.html", "<main><h1>Root</h1></main>");
  writeHtml(dir, `${scenario}/index.html`, `<main><h1>${scenario} index</h1></main>`);
  writeHtml(dir, `${scenario}/about.html`, `<main><h1>${scenario} about</h1></main>`);
}

function recipeDeepPath(dir: string, options: Record<string, unknown>): void {
  const depth = Number(options.depth ?? 3);
  const segments = Array.from({ length: depth }, (_, index) => `level-${index + 1}`);
  const pagePath = `${segments.join("/")}/index.html`;
  writeHtml(dir, "index.html", "<main><h1>Root</h1></main>");
  writeHtml(dir, pagePath, `<main><h1>Deep ${depth}</h1></main>`);
}

function recipeManyPages(dir: string, options: Record<string, unknown>): void {
  recipeMultiPage(dir, { count: Number(options.count ?? 10) });
}

function recipeExternalHttp(dir: string): void {
  writeHtml(
    dir,
    "index.html",
    "<main><h1>CDN</h1></main>",
    '<link rel="stylesheet" href="https://cdn.example.com/styles.css" />',
  );
}

function recipeModuleScript(dir: string): void {
  fs.mkdirSync(path.join(dir, "scripts"), { recursive: true });
  fs.writeFileSync(path.join(dir, "scripts/module.js"), "export const ok = true;\n", "utf8");
  writeHtml(
    dir,
    "index.html",
    '<main><h1>Module</h1><script type="module" src="scripts/module.js"></script></main>',
  );
}

function recipeDoubleStylesheet(dir: string): void {
  fs.writeFileSync(path.join(dir, "a.css"), "body { color: #111; }\n", "utf8");
  fs.writeFileSync(path.join(dir, "b.css"), "body { background: #fff; }\n", "utf8");
  writeHtml(
    dir,
    "index.html",
    "<main><h1>Two CSS</h1></main>",
    '<link rel="stylesheet" href="a.css" /><link rel="stylesheet" href="b.css" />',
  );
}

function recipeMinimalHtml(dir: string): void {
  writeHtml(dir, "index.html", "<p>min</p>");
}

function recipeForm(dir: string): void {
  writeHtml(
    dir,
    "index.html",
    '<main><form onsubmit="return false"><input name="q" /><button type="submit">Send</button></form></main>',
  );
}

function recipeInlineCompatible(dir: string): void {
  writeHtml(
    dir,
    "index.html",
    "<main><script>document.body.dataset.ready = '1';</script><p>ok</p></main>",
  );
}

function recipeUnicode(dir: string): void {
  writeHtml(dir, "index.html", "<main><h1>日本語タイトル</h1><p>emoji 🚀</p></main>");
}

const RECIPES: Record<string, (dir: string, options: Record<string, unknown>) => void> = {
  "single-html": recipeSingleHtml,
  "html-css": recipeHtmlCss,
  "html-css-js": recipeHtmlCssJs,
  "multi-page": recipeMultiPage,
  "nested-path": recipeNestedPath,
  "workers-bad": recipeWorkersBad,
  interaction: recipeInteraction,
  unsupported: recipeUnsupported,
  "css-url": recipeCssUrl,
  "extract-cards": recipeExtractCards,
  "slug-collision": recipeSlugCollision,
  "deep-path": recipeDeepPath,
  "many-pages": recipeManyPages,
  "external-http": recipeExternalHttp,
  "module-script": recipeModuleScript,
  "double-stylesheet": recipeDoubleStylesheet,
  "minimal-html": recipeMinimalHtml,
  form: recipeForm,
  "inline-compatible": recipeInlineCompatible,
  unicode: recipeUnicode,
};

export function generateFixtureDir(
  recipe: string,
  options: Record<string, unknown>,
  outDir: string,
): void {
  fs.mkdirSync(outDir, { recursive: true });
  const fn = RECIPES[recipe];
  if (!fn) {
    throw new Error(`Unknown fixture recipe: ${recipe}`);
  }
  fn(outDir, options);
}

export function generateFixtureZip(
  recipe: string,
  options: Record<string, unknown>,
  zipPath: string,
  tempRoot: string,
): void {
  const siteDir = path.join(tempRoot, "site");
  generateFixtureDir(recipe, options, siteDir);
  const zip = new AdmZip();
  zip.addLocalFolder(siteDir);
  zip.writeZip(zipPath);
}

export function listRecipes(): string[] {
  return Object.keys(RECIPES);
}

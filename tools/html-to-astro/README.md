# html-to-astro

Convert HTML/CSS/JS (directory or ZIP) into an **Astro 6.3.7 SSR** project targeting **Cloudflare Workers** (`@astrojs/cloudflare`).

## Commands

```bash
# Convert a folder or ZIP
vp run convert:html -- path/to/site ./astro-out

# With component extraction (cross-page fingerprint + scoped CSS)
vp run convert:html -- path/to/site ./astro-out --extract --extract-threshold 0.85

# Dry-run (validate + reports only)
vp run convert:html -- path/to/site ./astro-out --dry-run

# Local upload UI (127.0.0.1)
vp run convert:html:serve
```

With `--extract` enabled, the web UI runs a **manifest review** step:

1. **Analyze** — dry-run conversion returns `applied` / `suggested` extraction entries with HTML previews
2. **Review** — approve or reject `suggested` components via checkboxes
3. **Convert** — final ZIP includes auto-applied plus user-approved extractions

Use **Skip review** to download immediately (legacy one-step flow).

## Output layout

- `src/pages/*.astro` — SSR pages (no prerender)
- `src/layouts/BaseLayout.astro` — shared shell
- `src/components/` — optional extracted blocks (`--extract`)
- `public/` — static assets
- `.conversion/report.json` — warnings and Workers exclusions
- `.conversion/extraction-manifest.json` — component extraction log

## Component extraction (`--extract`)

When enabled, the converter:

1. Parses all pages into HAST and fingerprints repeated subtrees **across the whole site** (not per page only)
2. Extracts high-confidence matches into `src/components/*.astro` (e.g. shared `Nav`, repeated cards)
3. Moves matching CSS rules from global stylesheets into each component's `<style>` block (Astro scoped styles)
4. Records applied / suggested / skipped entries in `.conversion/extraction-manifest.json`

Structural fingerprints ignore `href` / `src` values so shared nav/footer layouts match even when links differ.

Variable text in repeated blocks (e.g. card titles and descriptions) becomes Astro props (`title`, `description`) automatically when values differ across instances.

## Workers compatibility

Scripts using Node APIs (`require('fs')`, `process`, etc.) are **removed** from output and listed in `report.json`.

## Tests

```bash
# Unit tests + 100 catalog fixture conversions (fast, L1/L2)
vp test tools/html-to-astro

# Catalog subset (regex on id or tags)
HTML_TO_ASTRO_CATALOG_FILTER=workers vp test tools/html-to-astro/catalog.test.ts

# Build smoke for catalog entries tagged smoke: true (requires network)
HTML_TO_ASTRO_SMOKE_BUILD=1 vp test tools/html-to-astro/build-smoke.test.ts
```

### Catalog fixtures (~100 patterns)

Fixtures are declared in [`fixtures/catalog/manifest.json`](fixtures/catalog/manifest.json):

- **4 static** — existing hand-written sites (`simple`, `multi`, `extract`, `realistic`)
- **96 generated** — built from recipes in [`src/test-fixtures/recipes.ts`](src/test-fixtures/recipes.ts)

Each catalog entry runs `convert()` + `@astrojs/compiler` parse + `report.json` assertions. Only entries with `"smoke": true` run `astro build` when `HTML_TO_ASTRO_SMOKE_BUILD=1`.

To add patterns: extend a `generatedSuites` variant list or add a new recipe + suite in the manifest.

## Manual build verification

```bash
vp run convert:html -- tools/html-to-astro/fixtures/simple /tmp/astro-out
cd /tmp/astro-out && pnpm install --config.dangerouslyAllowAllBuilds=true && pnpm build
npx wrangler dev   # optional
```

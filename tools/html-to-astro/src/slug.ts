const RESERVED_SLUGS = new Set(["api"]);

export function slugifySegment(segment: string): string {
  return segment
    .toLowerCase()
    .replace(/\.(html?|htm)$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

export function slugFromHtmlPath(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/");
  if (normalized === "index.html" || normalized.endsWith("/index.html")) {
    return "index";
  }
  const withoutExt = normalized.replace(/\.html?$/i, "");
  const parts = withoutExt.split("/").filter(Boolean);
  return parts.map(slugifySegment).join("-") || "index";
}

export function astroPagePathFromSlug(slug: string): string {
  if (slug === "index") {
    return "src/pages/index.astro";
  }
  return `src/pages/${slug}.astro`;
}

export function finalizeSlug(slug: string, reportReason?: string): string {
  if (!slug || slug === "-") {
    return reportReason ? "untitled-page" : "untitled-page";
  }
  if (RESERVED_SLUGS.has(slug)) {
    return `${slug}-page`;
  }
  return slug;
}

export type SlugAssignment = {
  relativePath: string;
  slug: string;
  astroPagePath: string;
  adjustment?: string;
};

export function assignSlugs(htmlRelativePaths: string[]): SlugAssignment[] {
  const base = htmlRelativePaths.map((relativePath) => {
    const slug = finalizeSlug(slugFromHtmlPath(relativePath));
    return { relativePath, slug, astroPagePath: astroPagePathFromSlug(slug) };
  });

  const slugCounts = new Map<string, number>();
  for (const item of base) {
    slugCounts.set(item.slug, (slugCounts.get(item.slug) ?? 0) + 1);
  }

  return base.map((item) => {
    if ((slugCounts.get(item.slug) ?? 0) <= 1) {
      return item;
    }

    const normalized = item.relativePath.replace(/\\/g, "/");
    if (normalized === "index.html" && item.slug === "index") {
      return item;
    }

    const dir = normalized.replace(/\/[^/]+$/, "");
    const dirSlug = dir ? slugifySegment(dir.replace(/\//g, "-")) : "page";
    const suffix =
      normalized.endsWith("/index.html") || normalized.endsWith("/index.htm") ? "index" : item.slug;
    const slug = finalizeSlug(dirSlug ? `${dirSlug}-${suffix}` : `${suffix}-page`);
    return {
      ...item,
      slug,
      astroPagePath: astroPagePathFromSlug(slug),
      adjustment: `collision: resolved to "${slug}"`,
    };
  });
}

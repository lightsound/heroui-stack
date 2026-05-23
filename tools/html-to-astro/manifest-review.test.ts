import { expect, test } from "vite-plus/test";

import { planCrossPageExtraction } from "./src/extract/replace.ts";

test("approveFingerprints promotes suggested entries to applied", () => {
  const nav = `<nav><a href="index.html">Home</a><a href="about.html">About</a></nav>`;
  const pages = [`<main>${nav}<h1>Home</h1></main>`, `<main>${nav}<h1>About</h1></main>`];
  const options = { enabled: true, threshold: 0.99 };

  const withoutApproval = planCrossPageExtraction(pages, options);
  expect(withoutApproval.manifest.suggested.length).toBeGreaterThan(0);
  expect(withoutApproval.items.length).toBe(0);

  const fingerprint = withoutApproval.manifest.suggested[0]?.fingerprint;
  expect(fingerprint).toBeTruthy();

  const withApproval = planCrossPageExtraction(pages, {
    ...options,
    approveFingerprints: [fingerprint!],
  });
  expect(withApproval.manifest.applied.some((item) => item.fingerprint === fingerprint)).toBe(true);
  expect(withApproval.manifest.suggested.some((item) => item.fingerprint === fingerprint)).toBe(
    false,
  );
  expect(withApproval.items.length).toBeGreaterThan(0);
});

test("manifest entries include previewHtml", () => {
  const nav = `<nav><a href="index.html">Home</a><a href="about.html">About</a></nav>`;
  const plan = planCrossPageExtraction(
    [`<main>${nav}<h1>Home</h1></main>`, `<main>${nav}<h1>About</h1></main>`],
    { enabled: true, threshold: 0.85 },
  );

  const entry = plan.manifest.applied[0];
  expect(entry?.previewHtml).toBeTruthy();
  expect(entry?.previewHtml).toContain("<nav");
});

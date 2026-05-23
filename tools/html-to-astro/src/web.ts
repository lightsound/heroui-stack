import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { serve } from "@hono/node-server";
import AdmZip from "adm-zip";
import { Hono } from "hono";

import { convert } from "./convert.ts";
import { createSession, deleteSession, getSession } from "./web/session.ts";

const HOST = "127.0.0.1";

export async function startWebServer(options: { port: number }): Promise<void> {
  const app = new Hono();

  app.get("/", () => {
    return new Response(HTML_UI, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  });

  app.post("/api/analyze", async (c) => {
    const form = await c.req.parseBody();
    const file = form["archive"];
    if (!(file instanceof File)) {
      return c.json({ error: "Expected multipart field 'archive' (ZIP)" }, 400);
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "html-to-astro-session-"));
    const zipPath = path.join(tempDir, "upload.zip");
    const threshold = Number(form["extractThreshold"] ?? "0.85");

    try {
      fs.writeFileSync(zipPath, Buffer.from(await file.arrayBuffer()));

      const result = await convert({
        input: zipPath,
        output: path.join(tempDir, "dry-run"),
        extract: true,
        extractThreshold: threshold,
        dryRun: true,
      });

      const session = createSession({
        zipPath,
        tempDir,
        extractThreshold: threshold,
        manifest: result.extraction,
      });

      return c.json({
        sessionId: session.id,
        manifest: session.manifest,
        pageCount: result.report.pages.length,
      });
    } catch (error) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ error: message }, 500);
    }
  });

  app.post("/api/convert", async (c) => {
    const body = await c.req.json<{ sessionId?: string; approvedFingerprints?: string[] }>();
    const sessionId = body.sessionId;
    if (!sessionId) {
      return c.json({ error: "sessionId is required" }, 400);
    }

    const session = getSession(sessionId);
    if (!session) {
      return c.json({ error: "Session expired or not found" }, 404);
    }

    const tempOut = fs.mkdtempSync(path.join(os.tmpdir(), "html-to-astro-out-"));

    try {
      await convert({
        input: session.zipPath,
        output: tempOut,
        extract: true,
        extractThreshold: session.extractThreshold,
        approveFingerprints: body.approvedFingerprints ?? [],
      });

      const zip = new AdmZip();
      zip.addLocalFolder(tempOut);
      const outBuffer = zip.toBuffer();

      deleteSession(sessionId);

      return new Response(outBuffer, {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": 'attachment; filename="astro-project.zip"',
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ error: message }, 500);
    } finally {
      fs.rmSync(tempOut, { recursive: true, force: true });
    }
  });

  app.post("/convert", async (c) => {
    const form = await c.req.parseBody();
    const file = form["archive"];
    if (!(file instanceof File)) {
      return c.json({ error: "Expected multipart field 'archive' (ZIP)" }, 400);
    }

    const tempIn = fs.mkdtempSync(path.join(os.tmpdir(), "html-to-astro-in-"));
    const tempOut = fs.mkdtempSync(path.join(os.tmpdir(), "html-to-astro-out-"));
    const zipPath = path.join(tempIn, "upload.zip");

    try {
      fs.writeFileSync(zipPath, Buffer.from(await file.arrayBuffer()));

      const extract = form["extract"] === "true" || form["extract"] === "on";
      const threshold = Number(form["extractThreshold"] ?? "0.85");

      await convert({
        input: zipPath,
        output: tempOut,
        extract,
        extractThreshold: threshold,
      });

      const zip = new AdmZip();
      zip.addLocalFolder(tempOut);
      const outBuffer = zip.toBuffer();

      return new Response(outBuffer, {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": 'attachment; filename="astro-project.zip"',
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ error: message }, 500);
    } finally {
      fs.rmSync(tempIn, { recursive: true, force: true });
      fs.rmSync(tempOut, { recursive: true, force: true });
    }
  });

  serve({ fetch: app.fetch, hostname: HOST, port: options.port }, (info) => {
    console.log(`html-to-astro UI: http://${info.address}:${info.port}`);
  });
}

const HTML_UI = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>HTML → Astro</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #f8f9fb;
      --surface: #fff;
      --border: #d8dee9;
      --text: #1a1d26;
      --muted: #5c6578;
      --accent: #006fee;
      --accent-hover: #005bc4;
      --success: #12a150;
      --warning: #f5a524;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0d1117;
        --surface: #161b22;
        --border: #30363d;
        --text: #e6edf3;
        --muted: #8b949e;
        --accent: #388bfd;
        --accent-hover: #58a6ff;
      }
    }
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text);
      margin: 0;
      line-height: 1.5;
    }
    .wrap { max-width: 52rem; margin: 0 auto; padding: 2rem 1rem 4rem; }
    h1 { font-size: 1.5rem; margin: 0 0 0.25rem; }
    .lead { color: var(--muted); margin: 0 0 1.5rem; }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 0.75rem;
      padding: 1.25rem;
      margin-bottom: 1rem;
    }
    .steps { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
    .step {
      font-size: 0.8125rem;
      padding: 0.25rem 0.625rem;
      border-radius: 999px;
      border: 1px solid var(--border);
      color: var(--muted);
    }
    .step.active { border-color: var(--accent); color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, transparent); }
    .step.done { border-color: var(--success); color: var(--success); }
    label { display: block; font-size: 0.875rem; font-weight: 500; margin-bottom: 0.375rem; }
    input[type="file"], input[type="number"] {
      width: 100%;
      padding: 0.5rem 0.625rem;
      border: 1px solid var(--border);
      border-radius: 0.5rem;
      background: var(--bg);
      color: var(--text);
    }
    .field { margin-bottom: 1rem; }
    .checkbox { display: flex; align-items: center; gap: 0.5rem; font-weight: 400; }
    .checkbox input { width: auto; }
    button {
      appearance: none;
      border: none;
      border-radius: 0.5rem;
      padding: 0.625rem 1rem;
      font-size: 0.9375rem;
      font-weight: 500;
      cursor: pointer;
      background: var(--accent);
      color: #fff;
    }
    button:hover:not(:disabled) { background: var(--accent-hover); }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    button.secondary {
      background: transparent;
      color: var(--text);
      border: 1px solid var(--border);
    }
    button.secondary:hover:not(:disabled) { background: var(--bg); }
    .actions { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 1rem; }
    .hidden { display: none !important; }
    .error {
      background: color-mix(in srgb, #f31260 12%, transparent);
      border: 1px solid #f31260;
      color: #f31260;
      padding: 0.75rem 1rem;
      border-radius: 0.5rem;
      margin-bottom: 1rem;
      font-size: 0.875rem;
    }
    .summary { font-size: 0.875rem; color: var(--muted); margin-bottom: 1rem; }
    .section-title {
      font-size: 0.8125rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--muted);
      margin: 0 0 0.75rem;
    }
    .entry {
      border: 1px solid var(--border);
      border-radius: 0.5rem;
      padding: 0.875rem;
      margin-bottom: 0.625rem;
    }
    .entry-header { display: flex; align-items: flex-start; gap: 0.625rem; }
    .entry-header input[type="checkbox"] { margin-top: 0.25rem; }
    .entry-name { font-weight: 600; font-size: 0.9375rem; }
    .entry-meta { font-size: 0.8125rem; color: var(--muted); margin-top: 0.125rem; }
    .badge {
      display: inline-block;
      font-size: 0.6875rem;
      font-weight: 600;
      padding: 0.125rem 0.375rem;
      border-radius: 0.25rem;
      margin-left: 0.375rem;
      vertical-align: middle;
    }
    .badge.applied { background: color-mix(in srgb, var(--success) 15%, transparent); color: var(--success); }
    .badge.suggested { background: color-mix(in srgb, var(--warning) 15%, transparent); color: var(--warning); }
    .preview {
      margin-top: 0.625rem;
      padding: 0.625rem;
      background: var(--bg);
      border-radius: 0.375rem;
      font-family: ui-monospace, monospace;
      font-size: 0.75rem;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 6rem;
      overflow-y: auto;
    }
    .props { font-size: 0.8125rem; color: var(--muted); margin-top: 0.25rem; }
    .toolbar { display: flex; gap: 0.5rem; margin-bottom: 0.75rem; flex-wrap: wrap; }
    .toolbar button { font-size: 0.8125rem; padding: 0.375rem 0.625rem; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>HTML → Astro</h1>
    <p class="lead">ZIP（HTML/CSS/JS）を Astro SSR プロジェクトに変換します。コンポーネント抽出時は manifest をレビューできます。</p>

    <div class="steps">
      <span class="step active" id="step1-label">1. アップロード</span>
      <span class="step" id="step2-label">2. レビュー</span>
      <span class="step" id="step3-label">3. ダウンロード</span>
    </div>

    <div id="error" class="error hidden"></div>

    <section class="card" id="upload-section">
      <form id="upload-form">
        <div class="field">
          <label for="archive">ZIP ファイル</label>
          <input type="file" id="archive" name="archive" accept=".zip" required />
        </div>
        <div class="field">
          <label for="extractThreshold">抽出しきい値</label>
          <input type="number" id="extractThreshold" name="extractThreshold" value="0.85" min="0" max="1" step="0.05" />
        </div>
        <div class="field">
          <label class="checkbox">
            <input type="checkbox" id="extract" name="extract" checked />
            コンポーネント抽出を有効にする
          </label>
        </div>
        <div class="field">
          <label class="checkbox">
            <input type="checkbox" id="skipReview" name="skipReview" />
            レビューをスキップして即ダウンロード
          </label>
        </div>
        <div class="actions">
          <button type="submit" id="submit-btn">解析してレビュー</button>
        </div>
      </form>
    </section>

    <section class="card hidden" id="review-section">
      <p class="summary" id="review-summary"></p>

      <div id="applied-section" class="hidden">
        <p class="section-title">自動適用（applied）</p>
        <div id="applied-list"></div>
      </div>

      <div id="suggested-section" class="hidden">
        <p class="section-title">要レビュー（suggested）</p>
        <div class="toolbar">
          <button type="button" class="secondary" id="select-all">すべて選択</button>
          <button type="button" class="secondary" id="select-none">選択解除</button>
        </div>
        <div id="suggested-list"></div>
      </div>

      <div id="empty-manifest" class="summary hidden">抽出候補は見つかりませんでした。しきい値を下げるか、複数ページで繰り返されるブロックを追加してください。</div>

      <div class="actions">
        <button type="button" class="secondary" id="back-btn">戻る</button>
        <button type="button" id="convert-btn">変換してダウンロード</button>
      </div>
    </section>
  </div>

  <script>
    const state = { sessionId: null, manifest: null };

    const uploadSection = document.getElementById("upload-section");
    const reviewSection = document.getElementById("review-section");
    const errorEl = document.getElementById("error");
    const uploadForm = document.getElementById("upload-form");
    const submitBtn = document.getElementById("submit-btn");
    const extractCheckbox = document.getElementById("extract");
    const skipReviewCheckbox = document.getElementById("skipReview");

    function setStep(step) {
      for (let i = 1; i <= 3; i++) {
        const el = document.getElementById("step" + i + "-label");
        el.classList.remove("active", "done");
        if (i < step) el.classList.add("done");
        if (i === step) el.classList.add("active");
      }
    }

    function showError(message) {
      errorEl.textContent = message;
      errorEl.classList.remove("hidden");
    }

    function clearError() {
      errorEl.classList.add("hidden");
      errorEl.textContent = "";
    }

    function updateSubmitLabel() {
      const extract = extractCheckbox.checked;
      const skip = skipReviewCheckbox.checked;
      submitBtn.textContent = extract && !skip ? "解析してレビュー" : "変換してダウンロード";
    }

    extractCheckbox.addEventListener("change", updateSubmitLabel);
    skipReviewCheckbox.addEventListener("change", updateSubmitLabel);
    updateSubmitLabel();

    function renderEntry(entry, kind, selectable) {
      const div = document.createElement("div");
      div.className = "entry";
      const confidence = Math.round(entry.confidence * 100);
      const props = entry.props?.length ? entry.props.join(", ") : "—";
      const preview = entry.previewHtml || "";
      div.innerHTML =
        '<div class="entry-header">' +
        (selectable ? '<input type="checkbox" data-fingerprint="' + entry.fingerprint + '" />' : "") +
        '<div><div class="entry-name">' + escapeHtml(entry.name) +
        '<span class="badge ' + kind + '">' + kind + '</span></div>' +
        '<div class="entry-meta">信頼度 ' + confidence + '% · 出現 ' + entry.occurrences + ' 回' +
        (entry.reason ? ' · ' + escapeHtml(entry.reason) : '') + '</div>' +
        '<div class="props">props: ' + escapeHtml(props) + '</div></div></div>' +
        (preview ? '<pre class="preview">' + escapeHtml(preview) + '</pre>' : "");
      return div;
    }

    function escapeHtml(text) {
      return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    function renderManifest(manifest, pageCount) {
      const applied = manifest.applied || [];
      const suggested = manifest.suggested || [];
      document.getElementById("review-summary").textContent =
        pageCount + " ページを解析しました。applied " + applied.length + " 件、suggested " + suggested.length + " 件。";

      const appliedList = document.getElementById("applied-list");
      appliedList.replaceChildren();
      for (const entry of applied) {
        appliedList.appendChild(renderEntry(entry, "applied", false));
      }
      document.getElementById("applied-section").classList.toggle("hidden", applied.length === 0);

      const suggestedList = document.getElementById("suggested-list");
      suggestedList.replaceChildren();
      for (const entry of suggested) {
        suggestedList.appendChild(renderEntry(entry, "suggested", true));
      }
      document.getElementById("suggested-section").classList.toggle("hidden", suggested.length === 0);
      document.getElementById("empty-manifest").classList.toggle("hidden", applied.length + suggested.length > 0);

      uploadSection.classList.add("hidden");
      reviewSection.classList.remove("hidden");
      setStep(2);
    }

    document.getElementById("select-all").addEventListener("click", () => {
      reviewSection.querySelectorAll('input[type="checkbox"][data-fingerprint]').forEach((cb) => {
        cb.checked = true;
      });
    });

    document.getElementById("select-none").addEventListener("click", () => {
      reviewSection.querySelectorAll('input[type="checkbox"][data-fingerprint]').forEach((cb) => {
        cb.checked = false;
      });
    });

    document.getElementById("back-btn").addEventListener("click", () => {
      reviewSection.classList.add("hidden");
      uploadSection.classList.remove("hidden");
      state.sessionId = null;
      state.manifest = null;
      setStep(1);
      clearError();
    });

    uploadForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearError();

      const file = document.getElementById("archive").files[0];
      if (!file) {
        showError("ZIP ファイルを選択してください。");
        return;
      }

      const extract = extractCheckbox.checked;
      const skipReview = skipReviewCheckbox.checked;
      const threshold = document.getElementById("extractThreshold").value;

      submitBtn.disabled = true;

      try {
        if (!extract || skipReview) {
          const formData = new FormData();
          formData.append("archive", file);
          if (extract) formData.append("extract", "on");
          formData.append("extractThreshold", threshold);

          const response = await fetch("/convert", { method: "POST", body: formData });
          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || "変換に失敗しました。");
          }
          await downloadBlob(await response.blob());
          setStep(3);
          return;
        }

        const formData = new FormData();
        formData.append("archive", file);
        formData.append("extractThreshold", threshold);

        const response = await fetch("/api/analyze", { method: "POST", body: formData });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "解析に失敗しました。");

        state.sessionId = data.sessionId;
        state.manifest = data.manifest;
        renderManifest(data.manifest, data.pageCount);
      } catch (err) {
        showError(err.message || String(err));
      } finally {
        submitBtn.disabled = false;
      }
    });

    document.getElementById("convert-btn").addEventListener("click", async () => {
      clearError();
      if (!state.sessionId) {
        showError("セッションが無効です。最初からやり直してください。");
        return;
      }

      const approved = [...reviewSection.querySelectorAll('input[type="checkbox"][data-fingerprint]:checked')]
        .map((cb) => cb.dataset.fingerprint);

      const convertBtn = document.getElementById("convert-btn");
      convertBtn.disabled = true;

      try {
        const response = await fetch("/api/convert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: state.sessionId, approvedFingerprints: approved }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "変換に失敗しました。");
        }

        await downloadBlob(await response.blob());
        setStep(3);
        state.sessionId = null;
      } catch (err) {
        showError(err.message || String(err));
      } finally {
        convertBtn.disabled = false;
      }
    });

    async function downloadBlob(blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "astro-project.zip";
      a.click();
      URL.revokeObjectURL(url);
    }
  </script>
</body>
</html>`;

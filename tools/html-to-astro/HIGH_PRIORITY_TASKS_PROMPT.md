# html-to-astro 高優先度タスク（別セッション用）

`heroui-stack` リポジトリの **html-to-astro** 変換ツールについて、**高優先度の残タスク**を実装してください。計画ファイル（`.cursor/plans/*.md`）は**編集しない**こと。

## 背景

`tools/html-to-astro/` に HTML/CSS/JS → Astro 6.3.7 SSR（`@astrojs/cloudflare`、Cloudflare Workers）変換 CLI が既にあります。Phase 1〜4（CLI、複数ページ、コンポーネント抽出、`--extract`、ローカル Web UI）は実装済みです。

| 項目       | パス                                                      |
| ---------- | --------------------------------------------------------- |
| コア       | `tools/html-to-astro/src/convert.ts`                      |
| CLI        | `tools/html-to-astro/src/cli.ts`（`vp run convert:html`） |
| テスト     | `tools/html-to-astro/convert.test.ts`                     |
| 仕様       | `tools/html-to-astro/README.md`                           |
| ツール規約 | ルート `AGENTS.md`（`vp` / `vp test` / `vp add`）         |

検証は `@astrojs/compiler` の `parse()` のみ。計画 Phase 2 の `**astro build` smoke は未実装\*\*。

## 今回やること（高優先度のみ）

### 1. `astro build` smoke テスト（最優先）

変換出力が実際にビルドできることを CI で担保する。

- `convert()` で fixture（最低 `fixtures/simple`、できれば `fixtures/multi` も）を一時ディレクトリに出力
- 出力先で依存インストールのあと `**astro build` が成功\*\*することをテスト
- `vp test` で走るようにする（例: `tools/html-to-astro/build-smoke.test.ts`）
- 遅い場合は環境変数 `HTML_TO_ASTRO_SMOKE_BUILD=1` のときだけ実行でもよい（README に記載）
- 失敗時は stderr をテスト出力に含める
- 必要なら `tools/html-to-astro/src/transform/astro-emit.ts` のテンプレートを**最小限**修正（`astro@6.3.7` と `@astrojs/cloudflare` のピン留めなど）

### 2. 実サイトに近い fixture と回帰テスト

代表ケースを fixture 化し、変換 + compiler 検証（できれば build smoke も）で固定する。

追加 fixture 例（外部 URL 依存は避ける）:

- 外部 CSS + `url()` アセット
- 外部 `<script src>`（Workers 互換な JS のみ）
- Workers 非互換 script → 除外され `report.json` の `excluded` に載る
- 複数ページ + 共有 `nav`
- （任意）`onclick` → `warnings` のみ、`client:`\* は付けない

各 fixture で assert:

- `convert()` が throw しない
- `src/pages/index.astro`、`astro.config.mjs` が存在
- `parse()` が通る
- `report.json` の `excluded` / `warnings` が期待どおり

### 3. 手動検証手順（README 追記）

```bash
vp run convert:html -- tools/html-to-astro/fixtures/simple /tmp/astro-out
cd /tmp/astro-out && pnpm install && pnpm build
npx wrangler dev   # 任意
```

## 制約

- 計画ファイルは編集しない
- スコープは上記 3 点のみ（ページ横断抽出・Web UI E2E・npm 公開はしない）
- 依存追加は `vp add`（AGENTS.md）
- 既存テスト 6 件を壊さない
- 完了前に `vp test tools/html-to-astro` と `vp check` を実行

## 完了条件

- smoke テスト（または env 付き smoke）が追加されローカルで成功
- 新 fixture が 1 つ以上あり回帰テストがある
- README に手動ビルド手順がある
- `vp check` / `vp test` が通る

実装後、変更ファイル一覧・テストの走らせ方・ビルド smoke の有効化方法を日本語で簡潔に報告すること。

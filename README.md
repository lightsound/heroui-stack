# TanStack Start Starter

A minimal application template built with [TanStack Start](https://tanstack.com/start) and [TanStack Router](https://tanstack.com/router), using [Vite+](https://viteplus.dev/) as the unified CLI for development, builds, formatting, linting, and tests.

## What you get

- **TanStack Start** with file-based routing under `src/routes/`
- **React 19** and **TypeScript**
- **Tailwind CSS 4** with the Vite plugin
- [**`@lightsound/cn`**](https://github.com/lightsound/cn) for class name merging (`tailwind-merge` under the hood)
- **Vite+**-managed tooling: Oxlint, Oxfmt, Vitest-style testing via `vite-plus/test` (see [AGENTS.md](AGENTS.md) for workflow and pitfalls)

## Requirements

Install [Vite+](https://viteplus.dev/guide/) so the `vp` command is available on your `PATH`.

This repo pins **`pnpm@10.32.1`** as the package manager; Vite+ (`vp install`, etc.) is the supported way to manage dependencies—avoid calling `pnpm` / `npm` / `yarn` directly for installs unless you know you need an exception.

## Getting started

```bash
git clone https://github.com/lightsound/tanstack-start-start.git
cd tanstack-start-start
vp install
vp dev
```

Open the URL printed in the terminal (Vite’s default is usually `http://localhost:5173`).

## Everyday commands

| Command      | Purpose                                                          |
| ------------ | ---------------------------------------------------------------- |
| `vp dev`     | Start the dev server with HMR                                    |
| `vp build`   | Production build                                                 |
| `vp preview` | Preview the production build locally                             |
| `vp check`   | Format, lint, and type-check (fix with `--fix` where applicable) |
| `vp test`    | Run tests                                                        |
| `vp help`    | List built-in commands and options                               |

`package.json` scripts (`dev`, `build`, `check`, `test`, …) delegate to these same `vp` entry points.

Optional maintenance tools (not part of `vp check`):

- `vp run knip` — unused files, dependencies, exports (`knip.config.ts`)
- `vp run doctor` — React health checks (`react-doctor`, `--no-lint` in the script)

## License

[MIT](LICENSE.md).

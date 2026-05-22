import type { KnipConfig } from "knip";

export default {
  // TypeScript の lib 差し替え用。import されないため未使用扱いになる
  ignoreDependencies: ["better-typescript-lib"],
} satisfies KnipConfig;

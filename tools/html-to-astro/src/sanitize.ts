function astroUnsafeControlPattern(): RegExp {
  const parts: string[] = [];
  for (let code = 0; code <= 0x1f; code++) {
    if (code === 0x09 || code === 0x0a) {
      continue;
    }
    parts.push(`\\x${code.toString(16).padStart(2, "0")}`);
  }
  parts.push("\\x7f");
  return new RegExp(`[${parts.join("")}]`, "g");
}

/** C0 controls that break @astrojs/compiler JSON parsing (keep tab + LF). */
const ASTRO_UNSAFE_CONTROLS = astroUnsafeControlPattern();

export function stripAstroUnsafeControls(value: string): string {
  return value.replace(ASTRO_UNSAFE_CONTROLS, "");
}

export function containsAstroUnsafeControls(value: string): boolean {
  ASTRO_UNSAFE_CONTROLS.lastIndex = 0;
  return ASTRO_UNSAFE_CONTROLS.test(value);
}

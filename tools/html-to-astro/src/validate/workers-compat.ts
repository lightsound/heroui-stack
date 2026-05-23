const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\brequire\s*\(/, reason: "CommonJS require is not available on Workers" },
  {
    pattern: /\bimport\s+.*\bfrom\s+['"]node:/,
    reason: "node: imports are not available on Workers",
  },
  { pattern: /\bimport\s+['"]fs['"]/, reason: "fs module is not available on Workers" },
  { pattern: /\bimport\s+['"]path['"]/, reason: "path module is not available on Workers" },
  {
    pattern: /\bimport\s+['"]child_process['"]/,
    reason: "child_process is not available on Workers",
  },
  { pattern: /\bprocess\./, reason: "process is not available on Workers" },
  { pattern: /\b__dirname\b/, reason: "__dirname is not available on Workers" },
  { pattern: /\b__filename\b/, reason: "__filename is not available on Workers" },
];

export function checkWorkersCompatible(source: string): {
  compatible: boolean;
  reason?: string;
} {
  for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
    if (pattern.test(source)) {
      return { compatible: false, reason };
    }
  }
  return { compatible: true };
}

export function snippetPreview(source: string, maxLen = 120): string {
  const oneLine = source.replace(/\s+/g, " ").trim();
  return oneLine.length <= maxLen ? oneLine : `${oneLine.slice(0, maxLen)}…`;
}

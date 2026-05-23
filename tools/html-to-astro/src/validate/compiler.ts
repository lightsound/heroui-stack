import { parse } from "@astrojs/compiler";

export async function validateAstroSource(
  source: string,
  filename: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await parse(source, { position: false });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `${filename}: ${message}` };
  }
}

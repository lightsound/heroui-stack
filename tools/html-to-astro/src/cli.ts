#!/usr/bin/env node
import path from "node:path";

import { Command } from "commander";

import { convert } from "./convert.ts";
import { startWebServer } from "./web.ts";

const program = new Command();

program
  .name("html-to-astro")
  .description("Convert HTML/CSS/JS to an Astro SSR project (Cloudflare Workers)")
  .version("0.1.0");

program
  .command("convert")
  .description("Convert a directory or ZIP of HTML to Astro")
  .argument("<input>", "Input directory or .zip file")
  .argument("[output]", "Output directory", "./astro-out")
  .option("--extract", "Extract repeated structures into components", false)
  .option("--extract-threshold <n>", "Confidence threshold for extraction", "0.85")
  .option("--dry-run", "Validate and report without writing files", false)
  .action(
    async (
      input: string,
      output: string,
      opts: { extract: boolean; extractThreshold: string; dryRun: boolean },
    ) => {
      try {
        const result = await convert({
          input: path.resolve(input),
          output: path.resolve(output),
          extract: opts.extract,
          extractThreshold: Number(opts.extractThreshold),
          dryRun: opts.dryRun,
        });

        console.log(
          `Converted ${result.report.pages.length} page(s)${opts.dryRun ? " (dry-run)" : ""} → ${path.resolve(output)}`,
        );
        if (result.report.excluded.length > 0) {
          console.log(
            `Excluded ${result.report.excluded.length} item(s) (Workers incompatible) — see .conversion/report.json`,
          );
        }
        if (result.report.warnings.length > 0) {
          console.log(`${result.report.warnings.length} warning(s) — see .conversion/report.json`);
        }
        if (opts.extract) {
          console.log(
            `Extraction: ${result.extraction.applied.length} applied, ${result.extraction.suggested.length} suggested`,
          );
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        process.exit(1);
      }
    },
  );

program
  .command("serve")
  .description("Local upload UI (127.0.0.1 only)")
  .option("-p, --port <n>", "Port", "4321")
  .action(async (opts: { port: string }) => {
    await startWebServer({ port: Number(opts.port) });
  });

program.parse();

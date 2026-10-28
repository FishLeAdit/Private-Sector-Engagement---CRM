// Odoo import dry run: npm.cmd run odoo:dry-run [-- --sample ready] [-- --contacts <csv> --deals <csv> --activities <csv>]
// [-- --offline]. Without file options it checks the fictional "mixed" samples in public/odoo-templates (or the
// "ready" ones with --sample ready). It only reads: the CSV files, and
// (unless --offline) the configured project's staff, stages, categories and contact emails/phones for
// duplicate checks. Nothing is imported or written. Never run it on real exports before PSE's field mapping.
// Settings → Odoo import check runs the same rules in the app, with the signed-in manager's own access.
import { readFile } from "node:fs/promises";
import type { FileKey } from "../src/features/odoo/columns";
import { CsvError, parseCsv, type CsvTable } from "../src/features/odoo/csv";
import { dryRun } from "../src/features/odoo/dry-run";
import { formatReport } from "../src/features/odoo/report";
import { loadReference } from "../src/features/odoo/reference";
import { createHostedDemoClient, SeedError } from "./lib/hosted-demo";

async function main() {
  const argv = process.argv.slice(2);
  const sample = argv.includes("--sample") && argv[argv.indexOf("--sample") + 1] === "ready" ? "ready" : "mixed";
  const files = Object.fromEntries(
    (["contacts", "deals", "activities"] as const).map(file => [
      file,
      `public/odoo-templates/${sample}/odoo-${file}.csv`,
    ]),
  ) as Record<FileKey, string>;
  for (const file of Object.keys(files) as FileKey[]) {
    const at = argv.indexOf(`--${file}`);
    if (at >= 0 && argv[at + 1]) files[file] = argv[at + 1];
  }
  const tables = {} as Record<FileKey, CsvTable>;
  for (const [file, path] of Object.entries(files) as [FileKey, string][]) {
    try {
      tables[file] = parseCsv(await readFile(path, "utf8"));
    } catch (error) {
      if (error instanceof CsvError) throw new SeedError(`${path}: ${error.message}`);
      throw new SeedError(`Could not read ${path}. Pass --${file} <csv> with a readable file.`);
    }
  }
  const reference = argv.includes("--offline")
    ? null
    : await loadReference(createHostedDemoClient(), action => {
        throw new SeedError(`${action} failed. Check the configured project and the service role key, then rerun.`);
      });
  console.log(formatReport(dryRun(tables, reference)));
}

main().catch(error => {
  console.error(error instanceof SeedError ? error.message : "The dry run failed unexpectedly.");
  process.exitCode = 1;
});

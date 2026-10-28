// The plain-text report printed by `npm run odoo:dry-run`; the Settings page renders the same report itself.
import type { FileKey } from "./columns";
import type { DryRunReport } from "./types";

export function formatReport(report: DryRunReport) {
  const lines = [
    "Odoo import dry run. Nothing was written.",
    "The template columns are awaiting PSE field mapping (docs/08-migration-plan.md).",
    report.offline
      ? "Offline: staff, stage, category and existing-contact checks were skipped."
      : "Checked read-only against the configured Supabase project: staff, stages, categories and existing contacts.",
    "Dates are read as Asia/Dhaka time until PSE confirms the export's timezone.",
  ];
  for (const file of Object.keys(report.files) as FileKey[]) {
    const s = report.files[file];
    const review = s.rows - s.ready;
    lines.push("", `${file}: ${s.rows} rows, ${s.ready} ready, ${review} ${review === 1 ? "needs" : "need"} review`);
    if (s.missing.length) lines.push(`  missing columns, file not checked: ${s.missing.join(", ")}`);
    if (s.ignored.length) lines.push(`  ignored columns: ${s.ignored.join(", ")}`);
    for (const f of report.findings.filter(f => f.file === file))
      lines.push(`  line ${f.line}${f.odooId ? ` (${f.odooId})` : ""}: ${f.message}`);
  }
  return lines.join("\n");
}

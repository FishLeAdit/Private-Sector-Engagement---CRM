import "server-only";
import type { AccessResult } from "@/lib/auth/session";
import { assertVerifiedPse } from "@/lib/auth/guards";
import { isPseManager } from "@/lib/auth/roles";
import { parseOrThrow } from "@/lib/validation";
import { columns, fileLabels, type FileKey } from "./columns";
import { CsvError, parseCsv, type CsvTable } from "./csv";
import { checkTables } from "./dry-run";
import { importRows } from "./import-plan";
import type { OdooRepository } from "./queries";
import { odooCheckSchema } from "./schemas";
import { OdooError, type ImportResult } from "./types";

// Migration is a manager task. The check only reads; the files arrive in the request and are never stored.
// An import repeats the check on the server and goes ahead only when nothing needs review.
export function createOdooService(repo: OdooRepository, access: AccessResult) {
  function authorize() {
    const actor = assertVerifiedPse(access, OdooError, "PSE access is required.");
    if (!isPseManager(actor.profile)) throw new OdooError(403, "Only a PSE manager can use the Odoo import.");
  }
  function tables(input: unknown) {
    const files = parseOrThrow(odooCheckSchema, input, OdooError, "Review the files to check.");
    if (!Object.values(files).some(text => text.trim()))
      throw new OdooError(422, "Choose at least one CSV file to check.");
    const parsed = {} as Record<FileKey, CsvTable>;
    for (const file of Object.keys(columns) as FileKey[]) {
      try {
        // A file left out is checked as empty, so the others' links to it are reported.
        parsed[file] = files[file].trim() ? parseCsv(files[file]) : { headers: [...columns[file]], rows: [] };
      } catch (error) {
        if (!(error instanceof CsvError)) throw error;
        throw new OdooError(422, `${fileLabels[file]} file: ${error.message}`, { [file]: [error.message] });
      }
    }
    return parsed;
  }
  return {
    async check(input: unknown) {
      authorize();
      const parsed = tables(input);
      return checkTables(parsed, await repo.reference()).report;
    },
    async import(input: unknown): Promise<ImportResult> {
      authorize();
      const parsed = tables(input);
      const { report, checked } = checkTables(parsed, await repo.reference());
      if (report.findings.length || Object.values(report.files).some(file => file.missing.length))
        throw new OdooError(422, "These files need review before they can be imported. Check them again.");
      const rows = importRows(checked);
      if (!rows.contacts.length && !rows.deals.length && !rows.activities.length)
        throw new OdooError(422, "These files have no rows to import.");
      await repo.importRows(rows);
      return {
        contacts: rows.contacts.map(row => row.id),
        deals: rows.deals.map(row => row.id),
        activities: rows.activities.map(row => row.id),
      };
    },
  };
}

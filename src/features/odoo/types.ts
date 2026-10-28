import { AppError } from "@/lib/errors";
import type { FileKey } from "./columns";

// What the check compares against: the project's existing contacts, staff, stages and categories.
export type Reference = {
  contacts: { name: string; email_normalized: string | null; phone_normalized: string | null }[];
  owners: { id: string; display_name: string; active: boolean }[];
  stages: { id: string; name: string; active: boolean }[];
  categories: { id: string; code: string; name: string; active: boolean }[];
  imported: Record<FileKey, string[]>; // Odoo IDs already in the CRM (migration 0017)
};
export type Finding = { file: FileKey; line: number; odooId: string; message: string };
export type FileSummary = { rows: number; ready: number; missing: string[]; ignored: string[] };
export type DryRunReport = { files: Record<FileKey, FileSummary>; findings: Finding[]; offline: boolean };

// What an import created: the counts, and each new record's ID for linking to it.
export type ImportResult = { contacts: string[]; deals: string[]; activities: string[] };

export class OdooError extends AppError {
  name = "OdooError";
}

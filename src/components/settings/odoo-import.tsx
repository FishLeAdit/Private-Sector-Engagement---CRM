"use client";
import { useState } from "react";
import Link from "next/link";
import type { DryRunReport, ImportResult } from "@/features/odoo/types";
import type { Texts } from "./odoo-import-check";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const counted = (counts: { contacts: number; deals: number; activities: number }) =>
  [
    plural(counts.contacts, "contact"),
    plural(counts.deals, "deal"),
    plural(counts.activities, "activity", "activities"),
  ].join(", ");

// Offered only when the check found nothing to review. The server checks the same files again before inserting,
// and the batch is one transaction.
export function OdooImport({
  report,
  texts,
  onImported,
}: {
  report: DryRunReport;
  texts: Texts;
  onImported: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState<ImportResult | null>(null);
  const files = Object.values(report.files);
  const rows = {
    contacts: report.files.contacts.rows,
    deals: report.files.deals.rows,
    activities: report.files.activities.rows,
  };
  const ready = !report.findings.length && files.every(f => !f.missing.length) && files.some(f => f.rows);

  async function run() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/settings/odoo-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(texts),
      });
      const data = await response.json();
      if (!response.ok) return setError(data.error || "The import failed. Nothing was imported.");
      setDone(data.result);
    } catch {
      setError("The result is uncertain. Check Contacts before importing again; a repeat is refused, not doubled.");
    } finally {
      setBusy(false);
    }
  }

  if (done)
    return (
      <section className="mt-6 max-w-5xl space-y-3 panel p-5" aria-labelledby="odoo-imported">
        <h2 id="odoo-imported" className="font-mono text-sm font-semibold">
          Import complete
        </h2>
        <p role="status">
          Imported{" "}
          {counted({ contacts: done.contacts.length, deals: done.deals.length, activities: done.activities.length })}.
        </p>
        <p className="flex flex-wrap gap-3 text-sm">
          <Link className="link" href="/contacts">
            Contacts
          </Link>
          <Link className="link" href="/opportunities">
            Opportunities
          </Link>
          <Link className="link" href="/activities">
            Activities
          </Link>
        </p>
        <button type="button" className="btn btn-outline btn-sm" onClick={onImported}>
          Check more files
        </button>
      </section>
    );
  if (!ready) return null;
  return (
    <section className="mt-6 max-w-5xl space-y-3 border border-success bg-success/5 p-5" aria-labelledby="odoo-ready">
      <h2 id="odoo-ready" className="font-mono text-sm font-semibold">
        Ready to import
      </h2>
      <p className="text-sm">
        Nothing needs review. Importing adds {counted(rows)} to the CRM in one step: all of them, or none if anything
        fails. Each keeps its Odoo ID, so the same files cannot be imported twice. Imported records can be edited and
        deleted like any other.
      </p>
      {error && (
        <p role="alert" className="text-error">
          {error}
        </p>
      )}
      <button type="button" className="btn btn-primary" disabled={busy} onClick={run}>
        {busy ? "Importing…" : `Import ${counted(rows)}`}
      </button>
    </section>
  );
}

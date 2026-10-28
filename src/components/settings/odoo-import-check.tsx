"use client";
import { useState } from "react";
import { fileLabels, fileModels, type FileKey } from "@/features/odoo/columns";
import { ODOO_FILE_LIMIT } from "@/features/odoo/schemas";
import type { DryRunReport } from "@/features/odoo/types";
import { OdooImport } from "./odoo-import";
import { OdooReport } from "./odoo-report";

const files = Object.keys(fileLabels) as FileKey[];
// Two fictional sample sets: "mixed" has a problem of every kind, "ready" passes and can be imported.
const sampleSets = { mixed: "mixed samples", ready: "ready samples" } as const;
type SampleSet = keyof typeof sampleSets;
const sample = (set: SampleSet, file: FileKey) => `/odoo-templates/${set}/odoo-${file}.csv`;
export type Texts = Partial<Record<FileKey, string>>;
type Result = { report: DryRunReport; sent: FileKey[]; source: string; texts: Texts };

// Sends the chosen exports (or a sample set) to the read-only check, shows its report and, when nothing needs
// review, offers the import.
export function OdooImportCheck() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<Result | null>(null);

  async function check(texts: Texts, source: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/settings/odoo-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(texts),
      });
      const data = await response.json();
      if (!response.ok) {
        setResult(null);
        setError(
          `${data.error || "The check failed."} ${Object.values(data.fields ?? {})
            .flat()
            .join(" ")}`,
        );
        return;
      }
      setResult({ report: data.report, sent: files.filter(file => texts[file]?.trim()), source, texts });
    } catch {
      setError("The check could not be run. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const chosen = files.flatMap(file => {
      const value = (form.elements.namedItem(file) as HTMLInputElement | null)?.files?.[0];
      return value?.size ? [[file, value] as const] : [];
    });
    if (!chosen.length) return setError("Choose at least one CSV file to check.");
    const tooLarge = chosen.find(([, value]) => value.size > ODOO_FILE_LIMIT);
    if (tooLarge) return setError(`${tooLarge[1].name} is over 2 MB. Use npm run odoo:dry-run for large exports.`);
    const texts = Object.fromEntries(
      await Promise.all(chosen.map(async ([file, value]) => [file, await value.text()])),
    );
    await check(texts, chosen.map(([, value]) => value.name).join(", "));
  }

  async function samples(set: SampleSet) {
    if (busy) return;
    try {
      const texts = Object.fromEntries(
        await Promise.all(files.map(async file => [file, await (await fetch(sample(set, file))).text()])),
      );
      await check(texts, `the ${sampleSets[set]}`);
    } catch {
      setError("The sample files could not be loaded. Try again.");
    }
  }

  return (
    <>
      <form onSubmit={submit} className="max-w-3xl space-y-5 panel p-6" aria-label="Files to check">
        <p className="text-sm text-muted">
          Deals and activities link to contacts and deals by their Odoo ID, so check the files together. A file left out
          is checked as empty. Each file can be up to 2 MB.
        </p>
        <fieldset disabled={busy} className="min-w-0 space-y-4">
          {files.map(file => (
            <div key={file} className="text-sm">
              <label className="block">
                {fileLabels[file]} <span className="font-mono text-xs text-muted">({fileModels[file]})</span>
                <input
                  name={file}
                  type="file"
                  accept=".csv,text/csv"
                  className="file-input file-input-bordered mt-2 block w-full max-w-md"
                />
              </label>
              <p className="mt-1 text-xs text-muted">
                Samples:{" "}
                {(Object.keys(sampleSets) as SampleSet[]).map((set, i) => (
                  <span key={set}>
                    {i > 0 && " · "}
                    <a className="link" href={sample(set, file)} download>
                      {set} {fileLabels[file].toLowerCase()}
                    </a>
                  </span>
                ))}
              </p>
            </div>
          ))}
        </fieldset>
        <div className="flex flex-wrap gap-3">
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Checking…" : "Check files"}
          </button>
          {(Object.keys(sampleSets) as SampleSet[]).map(set => (
            <button key={set} type="button" className="btn btn-outline" disabled={busy} onClick={() => samples(set)}>
              Check the {sampleSets[set]}
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="text-error">
            {error}
          </p>
        )}
      </form>
      {result && (
        <>
          <OdooReport report={result.report} sent={result.sent} source={result.source} />
          <OdooImport report={result.report} texts={result.texts} onImported={() => setResult(null)} />
        </>
      )}
    </>
  );
}

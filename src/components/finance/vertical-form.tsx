"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FinanceOptions } from "@/features/finance/types";
import { verticalSchema } from "@/features/finance/schemas";
export function VerticalForm({ verticals }: { verticals: FinanceOptions["verticals"] }) {
  const router = useRouter();
  const [id, setId] = useState(""),
    [values, setValues] = useState({ code: "", name: "", active: true, is_provisional: true }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const parsed = verticalSchema.safeParse({ ...(id ? { id } : {}), values });
    if (!parsed.success) {
      setError(parsed.error.issues.map(i => i.message).join(" "));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/targets/verticals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) setError(data.error || "Vertical could not be saved.");
      else {
        setId(data.id);
        router.refresh();
      }
    } catch {
      setError("Vertical could not be saved.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="max-w-xl space-y-5">
      <p className="text-sm">
        Configure target verticals independently of contribution categories. Confirm final labels with PSE; no VBD/SAC
        mapping is inferred.
      </p>
      <fieldset disabled={busy} className="space-y-4">
        <label className="block text-sm">
          Create or edit
          <select
            className="select select-bordered mt-2 w-full"
            value={id}
            onChange={e => {
              setId(e.target.value);
              const row = verticals.find(v => v.id === e.target.value);
              setValues(
                row
                  ? { code: row.code, name: row.name, active: row.active, is_provisional: row.is_provisional }
                  : { code: "", name: "", active: true, is_provisional: true },
              );
            }}
          >
            <option value="">New vertical</option>
            {verticals.map(v => (
              <option key={v.id} value={v.id}>
                {v.name}
                {!v.active ? " (inactive)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Code
          <input
            className="input input-bordered mt-2 w-full"
            value={values.code}
            maxLength={50}
            onChange={e => setValues(v => ({ ...v, code: e.target.value.toUpperCase() }))}
          />
        </label>
        <label className="block text-sm">
          Name
          <input
            className="input input-bordered mt-2 w-full"
            value={values.name}
            maxLength={200}
            onChange={e => setValues(v => ({ ...v, name: e.target.value }))}
          />
        </label>
        <label className="flex gap-2">
          <input
            type="checkbox"
            checked={values.active}
            onChange={e => setValues(v => ({ ...v, active: e.target.checked }))}
          />
          Active
        </label>
        <label className="flex gap-2">
          <input
            type="checkbox"
            checked={values.is_provisional}
            onChange={e => setValues(v => ({ ...v, is_provisional: e.target.checked }))}
          />
          Provisional terminology
        </label>
      </fieldset>
      {error && (
        <p role="alert" className="text-error">
          {error}
        </p>
      )}
      <button className="btn btn-primary" disabled={busy}>
        {busy ? "Saving…" : "Save vertical"}
      </button>
    </form>
  );
}

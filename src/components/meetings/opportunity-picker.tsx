"use client";
import { useEffect, useId, useState } from "react";
import type { MeetingOpportunity } from "@/features/meetings/types";
type Option = Pick<MeetingOpportunity, "id" | "deal_name">;
export function OpportunityPicker({ selected, onSelect, disabled = false, onBusyChange, optionsPath = "/api/meetings/options" }: { selected: MeetingOpportunity | null; onSelect: (value: MeetingOpportunity | null) => void; disabled?: boolean; onBusyChange?: (busy: boolean) => void; optionsPath?: string }) {
  const id = useId(), value = selected?.id ?? "";
  const [draft, setDraft] = useState({ value, text: selected?.deal_name ?? "" });
  const text = draft.value === value ? draft.text : selected?.deal_name ?? "";
  const query = text.trim();
  const [open, setOpen] = useState(false), [active, setActive] = useState(-1), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [result, setResult] = useState<{ query: string | null; rows: Option[]; error: string }>({ query: null, rows: [], error: "" });
  const rows = query === result.query ? result.rows : [];
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/opportunities?${new URLSearchParams({ q: query })}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error(); const data = await response.json();
        if (!controller.signal.aborted) setResult({ query, rows: data.opportunities, error: "" });
      } catch { if (!controller.signal.aborted) setResult({ query, rows: [], error: "Opportunity search is unavailable. Try again." }); }
    }, 250);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [query, open]);
  async function choose(row: Option) {
    if (busy) return;
    setBusy(true); onBusyChange?.(true); setError("");
    try {
      const response = await fetch(`${optionsPath}?${new URLSearchParams({ opportunity_id: row.id })}`, { cache: "no-store" });
      const data = await response.json(); if (!response.ok || !data.opportunity) throw new Error();
      onSelect(data.opportunity); setDraft({ value: row.id, text: row.deal_name }); setOpen(false); setActive(-1);
    } catch { setError("Opportunity details could not be loaded. Please try selecting it again."); }
    finally { setBusy(false); onBusyChange?.(false); }
  }
  return <div className="relative" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <label htmlFor={id} className="mb-2 block text-sm font-medium">Opportunity (optional)</label><div className="flex gap-2"><input id={id} role="combobox" aria-autocomplete="list" aria-controls={`${id}-results`} aria-expanded={open} aria-activedescendant={open && rows[active] ? `${id}-${active}` : undefined}
      className="input input-bordered w-full" autoComplete="off" maxLength={100} placeholder="Search existing deals" disabled={disabled || busy} value={text} onFocus={() => setOpen(true)}
      onChange={event => { setDraft({ value: "", text: event.target.value }); onSelect(null); setOpen(true); setActive(-1); }} onKeyDown={event => {
        if (event.key === "Escape") setOpen(false);
        if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActive(index => Math.min(index + 1, rows.length - 1)); }
        if (event.key === "ArrowUp") { event.preventDefault(); setActive(index => Math.max(index - 1, 0)); }
        if (event.key === "Enter" && open) { event.preventDefault(); if (rows[active]) void choose(rows[active]); }
      }} />{(text || selected) && <button type="button" className="btn btn-ghost" disabled={disabled || busy} onClick={() => { onSelect(null); setDraft({ value: "", text: "" }); setOpen(false); }}>Clear</button>}</div>
    {open && <ul id={`${id}-results`} role="listbox" aria-label="Existing opportunities" className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-base-300 bg-base-100 p-1 shadow-lg">{rows.map((row, index) => <li key={row.id} role="option" id={`${id}-${index}`} aria-selected={active === index || value === row.id}><button type="button" disabled={busy} onClick={() => choose(row)} className={`w-full rounded p-3 text-left hover:bg-base-200 ${index === active ? "bg-base-200" : ""}`}>{row.deal_name}</button></li>)}{!rows.length && <li role="presentation" className="p-3 text-sm">{result.query !== query ? "Searching…" : result.error || "No matching deals. A meeting can link to a contact instead."}</li>}</ul>}
    {busy && <p role="status" className="mt-2 text-xs">Loading opportunity contact details…</p>}{error && <p role="alert" className="mt-2 text-sm text-error">{error}</p>}
  </div>;
}

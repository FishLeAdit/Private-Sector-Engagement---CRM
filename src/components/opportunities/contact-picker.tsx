"use client";
import { useEffect, useId, useState } from "react";
import type { Party } from "@/features/opportunities/types";

export function ContactPicker({ value, selected, onSelect, label, individual = false, disabled = false }: {
  value: string; selected: Party | null; onSelect: (party: Party | null) => void; label: string; individual?: boolean; disabled?: boolean;
}) {
  const id = useId();
  const [draft, setDraft] = useState({ value, text: selected?.name ?? "" });
  const text = draft.value === value ? draft.text : selected?.id === value ? selected.name : "";
  const [open, setOpen] = useState(false), [active, setActive] = useState(-1);
  const [result, setResult] = useState<{ query: string | null; rows: Party[]; error: string }>({ query: null, rows: [], error: "" });
  const query = text.trim(), rows = result.query === query ? result.rows : [];
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/contacts?${new URLSearchParams({ kind: individual ? "individual" : "all", q: query })}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!controller.signal.aborted) setResult({ query, rows: data.contacts, error: "" });
      } catch { if (!controller.signal.aborted) setResult({ query, rows: [], error: "Contact search is unavailable. Try again." }); }
    }, 250);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [open, query, individual]);
  function choose(row: Party) { setDraft({ value: row.id, text: row.name }); onSelect(row); setOpen(false); setActive(-1); }
  return <div className="relative" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <label htmlFor={id} className="mb-2 block text-sm font-medium">{label}</label>
    <div className="flex gap-2"><input id={id} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-results`}
      aria-activedescendant={open && rows[active] ? `${id}-${active}` : undefined} autoComplete="off" className="input input-bordered w-full" value={text} disabled={disabled} placeholder="Search existing contacts"
      onFocus={() => setOpen(true)} onChange={event => { setDraft({ value: "", text: event.target.value }); onSelect(null); setOpen(true); setActive(-1); }}
      onKeyDown={event => {
        if (event.key === "Escape") setOpen(false);
        if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActive(index => Math.min(index + 1, rows.length - 1)); }
        if (event.key === "ArrowUp") { event.preventDefault(); setActive(index => Math.max(index - 1, 0)); }
        if (event.key === "Enter" && open) { event.preventDefault(); if (rows[active]) choose(rows[active]); }
      }} />
      {(value || text) && <button type="button" className="btn btn-ghost" disabled={disabled} onClick={() => { setDraft({ value: "", text: "" }); onSelect(null); setOpen(false); }} aria-label={`Clear ${label}`}>Clear</button>}
    </div>
    {open && <ul id={`${id}-results`} role="listbox" aria-label={label} className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-base-300 bg-base-100 p-1 shadow-lg">
      {rows.map((row, index) => <li key={row.id} id={`${id}-${index}`} role="option" aria-selected={active === index || value === row.id}>
        <button type="button" className={`w-full rounded p-3 text-left hover:bg-base-200 ${index === active ? "bg-base-200" : ""}`} onClick={() => choose(row)}>{row.name}<span className="block text-xs text-base-content/60">{row.kind} · {row.email || row.phone}</span></button>
      </li>)}
      {!rows.length && <li role="presentation" className="p-3 text-sm">{result.query !== query ? "Searching…" : result.error || "No contacts found. Create one below."}</li>}
    </ul>}
    {selected && value === selected.id && <p className="mt-2 break-all text-sm text-base-content/65">{[selected.email, selected.phone, selected.kind === "company" && selected.website].filter(Boolean).join(" · ")}</p>}
  </div>;
}

"use client";

import { useEffect, useId, useState } from "react";
import type { CompanyOption } from "@/features/contacts/types";

export function CompanyPicker({
  value,
  onChange,
  initial,
  disabled = false,
  name = "company_id",
}: {
  value: string;
  onChange: (id: string) => void;
  initial?: CompanyOption | null;
  disabled?: boolean;
  name?: string;
}) {
  const id = useId();
  const [text, setText] = useState(initial?.name ?? "");
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{ query: string | null; options: CompanyOption[]; error: string }>({
    query: null,
    options: [],
    error: "",
  });
  const [active, setActive] = useState(-1);
  const query = text.trim();
  const options = result.query === query ? result.options : [];

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ kind: "company", q: query });
        const response = await fetch(`/api/contacts?${params}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("Lookup unavailable");
        const data = await response.json();
        if (!controller.signal.aborted)
          setResult({
            query,
            options: data.contacts.map((company: CompanyOption) => ({ id: company.id, name: company.name })),
            error: "",
          });
      } catch {
        if (!controller.signal.aborted)
          setResult({ query, options: [], error: "Company search is unavailable. Please try again." });
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [open, query]);

  function choose(option: CompanyOption) {
    onChange(option.id);
    setText(option.name);
    setOpen(false);
    setActive(-1);
  }

  return (
    <div
      className="relative"
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <input type="hidden" name={name} value={value} />
      <label htmlFor={id} className="mb-2 block text-sm font-medium">
        Company / workplace <span className="font-normal text-base-content/60">(optional)</span>
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-controls={`${id}-results`}
          aria-expanded={open}
          aria-activedescendant={open && options[active] ? `${id}-option-${active}` : undefined}
          className="input input-bordered w-full"
          value={text}
          disabled={disabled}
          autoComplete="off"
          placeholder="Search existing companies"
          onFocus={() => setOpen(true)}
          onChange={event => {
            setText(event.target.value);
            onChange("");
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={event => {
            if (event.key === "Escape") {
              setOpen(false);
              return;
            }
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setActive(index => Math.min(index + 1, options.length - 1));
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive(index => Math.max(index - 1, 0));
            }
            if (event.key === "Enter" && open && options[active]) {
              event.preventDefault();
              choose(options[active]);
            }
          }}
        />
        {(value || text) && (
          <button
            className="btn btn-ghost"
            type="button"
            aria-label="Clear company"
            disabled={disabled}
            onClick={() => {
              onChange("");
              setText("");
              setOpen(false);
            }}
          >
            Clear
          </button>
        )}
      </div>
      {open && (
        <ul
          id={`${id}-results`}
          role="listbox"
          aria-label="Existing companies"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-base-300 bg-base-100 p-1 shadow-lg"
        >
          {options.map((option, index) => (
            <li
              key={option.id}
              role="option"
              id={`${id}-option-${index}`}
              aria-selected={option.id === value || active === index}
            >
              <button
                className={`w-full rounded-md px-3 py-2 text-left hover:bg-base-200 ${active === index ? "bg-base-200" : ""}`}
                type="button"
                onClick={() => choose(option)}
              >
                {option.name}
              </button>
            </li>
          ))}
          {!options.length && (
            <li role="presentation" className="px-3 py-3 text-sm text-base-content/70">
              {result.query !== query
                ? "Searching…"
                : result.error || "No companies found. Create a Company contact first, or leave this unassigned."}
            </li>
          )}
        </ul>
      )}
      <p className="mt-1 text-xs text-base-content/60">Select an existing company, or leave this unassigned.</p>
    </div>
  );
}

"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FinanceOptions } from "@/features/finance/types";
import { targetSchema, type TargetInput } from "@/features/finance/schemas";
import { cents, decimal, percentAmount } from "@/features/finance/money";
export function TargetForm({
  initial,
  options,
  year,
}: {
  initial?: TargetInput;
  options: FinanceOptions;
  year: number;
}) {
  const router = useRouter(),
    id = useRef(initial?.request_id ?? "");
  const [draft, setDraft] = useState<TargetInput>(
      initial ?? {
        request_id: "",
        expected_updated_at: "",
        year,
        currency: "BDT",
        annual_amount: "",
        quarters: [1, 2, 3, 4].map(quarter => ({ quarter, amount: "0.00" })),
        allocations: [],
      },
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [percentages, setPercentages] = useState<Record<number, string>>({});
  function allocation(index: number, values: Partial<TargetInput["allocations"][number]>) {
    setDraft(d => ({ ...d, allocations: d.allocations.map((a, i) => (i === index ? { ...a, ...values } : a)) }));
  }
  function remainder(quarter?: number) {
    try {
      const total = draft.allocations.filter(a => a.quarter === quarter).reduce((sum, a) => sum + cents(a.amount), 0n);
      return quarter
        ? decimal(cents(draft.quarters.find(q => q.quarter === quarter)!.amount) - total)
        : decimal(cents(draft.annual_amount) - draft.quarters.reduce((sum, q) => sum + cents(q.amount), 0n));
    } catch {
      return "Enter valid amounts";
    }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    id.current ||= crypto.randomUUID();
    const parsed = targetSchema.safeParse({ ...draft, request_id: id.current });
    if (!parsed.success) {
      setError(parsed.error.issues.map(i => i.message).join(" "));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(initial ? `/api/targets/${id.current}` : "/api/targets", {
        method: initial ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(parsed.data),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(
          `${result.error || "Draft could not be saved."} ${Object.values(result.fields ?? {})
            .flat()
            .join(" ")}`,
        );
        return;
      }
      router.push(`/targets/${result.id}`);
      router.refresh();
    } catch {
      setError(
        "Save result is uncertain. Open Targets and check the saved plan before trying again; do not create a second plan.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="space-y-6" noValidate>
      <p className="rounded-lg bg-info/10 p-4 text-sm">
        Save an incomplete draft as you work. Approval requires reconciled annual, quarterly and employee/vertical
        amounts and permanently locks the plan.
      </p>
      <fieldset disabled={busy} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-sm">
            Year *
            <input
              type="number"
              min={1}
              max={9998}
              className="input input-bordered mt-2 w-full"
              value={draft.year}
              onChange={e => setDraft(d => ({ ...d, year: Number(e.target.value) }))}
            />
          </label>
          <label className="text-sm">
            Currency *
            <input
              maxLength={3}
              className="input input-bordered mt-2 w-full"
              value={draft.currency}
              onChange={e => setDraft(d => ({ ...d, currency: e.target.value.toUpperCase() }))}
            />
          </label>
          <label className="text-sm">
            Annual target *
            <input
              inputMode="decimal"
              className="input input-bordered mt-2 w-full"
              value={draft.annual_amount}
              onChange={e => setDraft(d => ({ ...d, annual_amount: e.target.value }))}
            />
          </label>
        </div>
        <section className="space-y-4 rounded-lg border border-base-300 p-5">
          <h2 className="text-lg font-semibold">Quarter baselines</h2>
          <p className="text-sm">
            Distribute the annual target unevenly if needed. Annual amount left to allocate: {remainder()}{" "}
            {draft.currency}
          </p>
          <div className="grid gap-4 sm:grid-cols-4">
            {draft.quarters.map(q => (
              <label key={q.quarter} className="text-sm">
                Q{q.quarter} target
                <input
                  inputMode="decimal"
                  value={q.amount}
                  className="input input-bordered mt-2 w-full"
                  onChange={e =>
                    setDraft(d => ({
                      ...d,
                      quarters: d.quarters.map(item =>
                        item.quarter === q.quarter ? { ...item, amount: e.target.value } : item,
                      ),
                    }))
                  }
                />
              </label>
            ))}
          </div>
        </section>
        <section className="space-y-4 rounded-lg border border-base-300 p-5">
          <h2 className="text-lg font-semibold">Employee × vertical allocations</h2>
          <p className="text-sm text-base-content/65">
            Add a row for each employee/vertical pair in a quarter. Percentage inputs calculate an amount from that
            quarter’s target, rounded down to cents. Assign the displayed remainder explicitly before approval. Stored
            amounts are the source of truth; percentages are calculation aids.
          </p>
          {[1, 2, 3, 4].map(q => (
            <p key={q} className="text-sm">
              Q{q} left to allocate: {remainder(q)} {draft.currency}
            </p>
          ))}
          {!options.verticals.some(v => v.active) && (
            <p role="alert" className="text-warning">
              Configure active target verticals before allocating. Final terminology remains a PSE decision.
            </p>
          )}
          <div className="space-y-4">
            {draft.allocations.map((a, index) => (
              <div key={index} className="grid gap-3 rounded-lg bg-base-200 p-4 sm:grid-cols-3 lg:grid-cols-6">
                <label className="text-xs">
                  Quarter
                  <select
                    aria-label={`Allocation ${index + 1} quarter`}
                    value={a.quarter}
                    className="select select-bordered mt-1 w-full"
                    onChange={e => allocation(index, { quarter: Number(e.target.value) })}
                  >
                    {[1, 2, 3, 4].map(q => (
                      <option key={q} value={q}>
                        Q{q}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs">
                  Employee
                  <select
                    aria-label={`Allocation ${index + 1} employee`}
                    value={a.employee_id}
                    className="select select-bordered mt-1 w-full"
                    onChange={e => allocation(index, { employee_id: e.target.value })}
                  >
                    <option value="">Choose…</option>
                    {options.employees.map(e => (
                      <option key={e.id} value={e.id} disabled={!e.active}>
                        {e.display_name}
                        {!e.active ? " (inactive)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs">
                  Vertical
                  <select
                    aria-label={`Allocation ${index + 1} vertical`}
                    value={a.vertical_id}
                    className="select select-bordered mt-1 w-full"
                    onChange={e => allocation(index, { vertical_id: e.target.value })}
                  >
                    <option value="">Choose…</option>
                    {options.verticals.map(v => (
                      <option key={v.id} value={v.id} disabled={!v.active}>
                        {v.name}
                        {v.is_provisional ? " (provisional)" : ""}
                        {!v.active ? " (inactive)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs">
                  % of quarter
                  <input
                    aria-label={`Allocation ${index + 1} percentage`}
                    inputMode="decimal"
                    className="input input-bordered mt-1 w-full"
                    value={percentages[index] ?? ""}
                    onChange={e => setPercentages(p => ({ ...p, [index]: e.target.value }))}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs mt-1"
                    onClick={() => {
                      try {
                        allocation(index, {
                          amount: percentAmount(
                            draft.quarters.find(q => q.quarter === a.quarter)!.amount,
                            percentages[index] ?? "",
                          ),
                        });
                        setError("");
                      } catch (error) {
                        setError((error as Error).message);
                      }
                    }}
                  >
                    Apply percentage
                  </button>
                </label>
                <label className="text-xs">
                  Amount
                  <input
                    aria-label={`Allocation ${index + 1} amount`}
                    inputMode="decimal"
                    className="input input-bordered mt-1 w-full"
                    value={a.amount}
                    onChange={e => allocation(index, { amount: e.target.value })}
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm self-center"
                  aria-label={`Remove allocation ${index + 1}`}
                  onClick={() => {
                    setDraft(d => ({ ...d, allocations: d.allocations.filter((_, i) => i !== index) }));
                    setPercentages({});
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={draft.allocations.length >= 4000}
            onClick={() =>
              setDraft(d => ({
                ...d,
                allocations: [...d.allocations, { quarter: 1, employee_id: "", vertical_id: "", amount: "0.00" }],
              }))
            }
          >
            Add allocation
          </button>
        </section>
      </fieldset>
      {error && (
        <p role="alert" className="whitespace-pre-wrap text-error">
          {error}
        </p>
      )}
      <button className="btn btn-primary" disabled={busy}>
        {busy ? "Saving…" : "Save draft"}
      </button>
    </form>
  );
}

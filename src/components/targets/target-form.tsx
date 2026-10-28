"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FinanceOptions } from "@/features/finance/types";
import { buildAllocations, gridFromAllocations, usedVerticals } from "@/features/targets/allocation-grid";
import { targetSchema, type TargetInput } from "@/features/targets/schemas";
import { cents, decimal } from "@/lib/money";
import { sendJson } from "@/lib/send-json";
import { AllocationGrid } from "./allocation-grid";

// Annual target → four quarter baselines → member amounts → vertical percentages. Drafts may be
// incomplete; the plan's ID doubles as the request ID so a retried save updates the same draft.
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
    [error, setError] = useState("");
  // The member × vertical split being edited; it becomes draft.allocations only when saving.
  const [grid, setGrid] = useState(() => gridFromAllocations(draft.allocations));
  const used = usedVerticals(grid);
  const verticalIds = options.verticals.filter(v => v.active || used.has(v.id)).map(v => v.id);
  const quarterTargets = Object.fromEntries(draft.quarters.map(q => [q.quarter, q.amount]));

  function annualRemainder() {
    try {
      return decimal(cents(draft.annual_amount) - draft.quarters.reduce((sum, q) => sum + cents(q.amount), 0n));
    } catch {
      return "Enter valid amounts";
    }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const name = (employee: string) => options.employees.find(e => e.id === employee)?.display_name ?? "Employee";
    const { allocations, problems } = buildAllocations(grid, verticalIds, name);
    if (problems.length) {
      setError(problems.join("\n"));
      return;
    }
    id.current ||= crypto.randomUUID();
    const parsed = targetSchema.safeParse({ ...draft, allocations, request_id: id.current });
    if (!parsed.success) {
      setError(parsed.error.issues.map(i => i.message).join(" "));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { ok, result } = await sendJson(
        initial ? `/api/targets/${id.current}` : "/api/targets",
        initial ? "PATCH" : "POST",
        parsed.data,
      );
      if (!ok) {
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
      <p className="border-l-2 border-info bg-info/5 p-4 text-sm">
        Save an incomplete draft as you work. Approval requires reconciled annual, quarterly and employee/vertical
        amounts and permanently locks the plan.
      </p>
      {/* min-w-0: a fieldset otherwise grows to its widest content, so the grid's table could not scroll. */}
      <fieldset disabled={busy} className="min-w-0 space-y-6">
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
        <section className="space-y-4 panel p-5">
          <h2 className="text-lg font-semibold">Quarter baselines</h2>
          <p className="text-sm">
            Distribute the annual target unevenly if needed. Annual amount left to allocate: {annualRemainder()}{" "}
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
        <section className="space-y-4 panel p-5">
          <h2 className="text-lg font-semibold">Member and vertical allocations</h2>
          <p className="text-sm text-base-content/65">
            For each quarter, give each member their amount, then split it across verticals by percentage; a member’s
            split must total 100%. Amounts are calculated and rounded down to the cent, with any leftover cents on the
            member’s last vertical, so they always add up. The calculated amounts are what gets saved.
          </p>
          {!options.verticals.some(v => v.active) ? (
            <p role="alert" className="text-warning">
              Configure active target verticals before allocating. Final terminology remains a PSE decision.
            </p>
          ) : (
            <AllocationGrid
              grid={grid}
              onChange={setGrid}
              quarterTargets={quarterTargets}
              currency={draft.currency}
              options={options}
              verticalIds={verticalIds}
            />
          )}
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

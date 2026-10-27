"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FinanceOptions } from "@/features/finance/types";
import { targetSchema, type TargetInput } from "@/features/targets/schemas";
import { cents, decimal, percentAmount, percentOf } from "@/lib/money";
import { sendJson } from "@/lib/send-json";
import { AllocationRow } from "./allocation-row";

// Annual target → four quarter baselines → employee × vertical cells. Drafts may be incomplete;
// the plan's ID doubles as the request ID so a retried save updates the same draft.
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
  // The percentage box currently being typed in. Every other box shows its row's amount as a share of the quarter.
  const [typing, setTyping] = useState<{ index: number; text: string; error: string } | null>(null);
  const quarterTarget = (quarter: number) => draft.quarters.find(q => q.quarter === quarter)?.amount ?? "";

  function allocation(index: number, values: Partial<TargetInput["allocations"][number]>) {
    setDraft(d => ({ ...d, allocations: d.allocations.map((a, i) => (i === index ? { ...a, ...values } : a)) }));
  }
  // Typing a percentage sets the amount straight away, so nothing typed can be lost on save.
  function typePercentage(index: number, text: string) {
    const value = text.trim();
    let problem = "";
    // Empty, or a trailing dot still being typed, leaves the amount as it is.
    if (value && !/^\d{1,3}\.$/.test(value)) {
      const target = quarterTarget(draft.allocations[index].quarter);
      try {
        allocation(index, { amount: percentAmount(target, value) });
      } catch (failure) {
        problem = /^\d+(\.\d{1,2})?$/.test(target) ? (failure as Error).message : "Enter a valid quarter target first.";
      }
    }
    setTyping({ index, text, error: problem });
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
            Add a row for each employee/vertical pair in a quarter. Enter either the amount or a percentage of that
            quarter’s target; the other updates to match. Percentages round down to the cent, so assign any remaining
            cents explicitly before approval. The amount is what gets saved.
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
              <AllocationRow
                key={index}
                index={index}
                allocation={a}
                options={options}
                percentage={typing?.index === index ? typing.text : percentOf(a.amount, quarterTarget(a.quarter))}
                percentageError={typing?.index === index ? typing.error : ""}
                onChange={values => allocation(index, values)}
                onPercentageChange={value => typePercentage(index, value)}
                onPercentageBlur={() => setTyping(null)}
                onRemove={() => {
                  setDraft(d => ({ ...d, allocations: d.allocations.filter((_, i) => i !== index) }));
                  setTyping(null);
                }}
              />
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

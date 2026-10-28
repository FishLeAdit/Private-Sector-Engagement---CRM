"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FinanceOptions } from "@/features/finance/types";
import { contributionSchema } from "@/features/contributions/schemas";
import { fromDhakaDateTimeInput } from "@/lib/dates";
type Opportunity = { id: string; deal_name: string; owner_id: string; currency: string; contribution_type: string };
export function ContributionForm({
  opportunity,
  options,
  userId,
  manager,
}: {
  opportunity: Opportunity;
  options: FinanceOptions;
  userId: string;
  manager: boolean;
}) {
  const router = useRouter(),
    requestId = useRef<string | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [review, setReview] = useState(false),
    [retryOnly, setRetryOnly] = useState(false);
  const snapshot = useRef<unknown>(null);
  // Members credit themselves; a manager may credit anyone and starts from the deal's focal person.
  const defaultEmployee =
    manager && options.employees.some(e => e.id === opportunity.owner_id && e.active) ? opportunity.owner_id : userId;
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    const data = new FormData(event.currentTarget);
    requestId.current ??= crypto.randomUUID();
    const parsed = contributionSchema.safeParse({
      request_id: requestId.current,
      opportunity_id: opportunity.id,
      employee_id: data.get("employee_id"),
      target_vertical_id: data.get("target_vertical_id"),
      amount: data.get("amount"),
      currency: opportunity.currency,
      contribution_type: opportunity.contribution_type,
      recognized_at: fromDhakaDateTimeInput(String(data.get("recognized_at") ?? "")),
      approved_value_note: data.get("approved_value_note") ?? "",
      valuation_reference_url: data.get("valuation_reference_url") ?? "",
      notes: data.get("notes") ?? "",
    });
    if (!parsed.success) {
      setError(parsed.error.issues.map(i => i.message).join(" "));
      return;
    }
    snapshot.current = parsed.data;
    setReview(true);
  }
  async function record() {
    if (busy || !snapshot.current) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/contributions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(snapshot.current),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(
          `${data.error || "Recording failed."} ${Object.values(data.fields ?? {})
            .flat()
            .join(" ")}`,
        );
        if (response.status >= 500) setRetryOnly(true);
        return;
      }
      router.push(`/contributions/${data.contribution.id}`);
      router.refresh();
    } catch {
      setRetryOnly(true);
      setError(
        "The result is uncertain. Retry the same submission safely, or check Contributions before starting another entry.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="max-w-3xl space-y-5">
      <p className="border-l-2 border-warning bg-warning/5 p-4 text-sm">
        Record only realized cash or confirmed valued in-kind support. This creates an append-only financial record that
        cannot be edited or deleted; a PSE manager can later reverse it with a correction entry.
      </p>
      <p className="text-sm">
        {opportunity.deal_name} · {opportunity.currency} ·{" "}
        {opportunity.contribution_type === "cash" ? "Cash" : "Valued in-kind"}. Expected value is not copied into the
        amount.
      </p>
      <fieldset disabled={busy || review} className="space-y-5">
        <label className="block text-sm">
          Actual amount received / agreed value *
          <input
            name="amount"
            inputMode="decimal"
            required
            className="input input-bordered mt-2 w-full"
            placeholder="0.00"
          />
        </label>
        <label className="block text-sm">
          Recognition date/time (Asia/Dhaka) *
          <input name="recognized_at" type="datetime-local" required className="input input-bordered mt-2 w-full" />
        </label>
        {manager ? (
          <label className="block text-sm">
            Attributed employee *
            <select name="employee_id" defaultValue={defaultEmployee} className="select select-bordered mt-2 w-full">
              {options.employees
                .filter(e => e.active)
                .map(e => (
                  <option key={e.id} value={e.id}>
                    {e.display_name}
                  </option>
                ))}
            </select>
          </label>
        ) : (
          <div className="text-sm">
            <label htmlFor="contribution-employee" className="block">
              Attributed employee *
            </label>
            <input type="hidden" name="employee_id" value={userId} />
            <input
              id="contribution-employee"
              readOnly
              aria-describedby="contribution-employee-hint"
              className="input input-bordered mt-2 w-full bg-base-200"
              value={options.employees.find(e => e.id === userId)?.display_name ?? "You"}
            />
            <p id="contribution-employee-hint" className="mt-1 text-xs text-base-content/60">
              Contributions are credited to you. A PSE manager can record one for another employee.
            </p>
          </div>
        )}
        <label className="block text-sm">
          Target vertical (optional)
          <select name="target_vertical_id" className="select select-bordered mt-2 w-full">
            <option value="">Unassigned</option>
            {options.verticals
              .filter(v => v.active)
              .map(v => (
                <option key={v.id} value={v.id}>
                  {v.name}
                  {v.is_provisional ? " (provisional)" : ""}
                </option>
              ))}
          </select>
        </label>
        <p className="text-xs text-base-content/60">
          Employee/vertical attribution is saved independently of future opportunity ownership. Categories do not
          automatically map to verticals.
        </p>
        {opportunity.contribution_type === "valued_in_kind" && (
          <>
            <label className="block text-sm">
              Agreed valuation and operational-team estimate source *
              <textarea
                name="approved_value_note"
                required
                maxLength={10000}
                className="textarea textarea-bordered mt-2 min-h-28 w-full"
              />
            </label>
            <label className="block text-sm">
              Inventory / estimate reference URL (optional)
              <input
                name="valuation_reference_url"
                type="url"
                maxLength={2048}
                className="input input-bordered mt-2 w-full"
              />
            </label>
          </>
        )}
        <label className="block text-sm">
          Notes / receipt references (optional)
          <textarea
            name="notes"
            maxLength={10000}
            className="textarea textarea-bordered mt-2 min-h-28 w-full"
            placeholder="Receipt or Google Drive reference; no direct uploads."
          />
        </label>
      </fieldset>
      {review && (
        <section className="space-y-3 border border-warning bg-warning/5 p-4" aria-label="Review contribution">
          <h2 className="font-semibold">Confirm this financial entry</h2>
          <p className="text-sm">
            Review the amount, recognition date, attribution and supporting references above. Saving records
            achievement; it does not move the opportunity stage.
          </p>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={record}>
            {busy ? "Recording…" : retryOnly ? "Retry same submission" : "Confirm and record contribution"}
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy || retryOnly} onClick={() => setReview(false)}>
            Back to edit
          </button>
        </section>
      )}
      {error && (
        <p role="alert" className="whitespace-pre-wrap text-error">
          {error}
        </p>
      )}
      {!review && (
        <button className="btn btn-primary" disabled={busy}>
          Review contribution
        </button>
      )}
    </form>
  );
}

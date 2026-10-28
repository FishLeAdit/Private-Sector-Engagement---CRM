"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { correctionSchema, type CorrectionInput } from "@/features/contributions/schemas";
import { cents, money } from "@/lib/money";

// A manager's reversal of part or all of a receipt. Like the contribution form it asks for confirmation first,
// because the entry is permanent, and it keeps one request ID across retries so a retry never doubles it.
export function CorrectionForm({
  contributionId,
  currency,
  remaining,
}: {
  contributionId: string;
  currency: string;
  remaining: string;
}) {
  const router = useRouter(),
    form = useRef<HTMLFormElement>(null),
    requestId = useRef<string | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(""),
    [reviewed, setReviewed] = useState<CorrectionInput | null>(null),
    [retryOnly, setRetryOnly] = useState(false);
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setDone("");
    const data = new FormData(event.currentTarget);
    requestId.current ??= crypto.randomUUID();
    const parsed = correctionSchema.safeParse({
      request_id: requestId.current,
      amount: data.get("amount"),
      reason: data.get("reason") ?? "",
    });
    if (!parsed.success) {
      setError(parsed.error.issues.map(i => i.message).join(" "));
      return;
    }
    if (cents(parsed.data.amount) > cents(remaining)) {
      setError(`At most ${money(remaining, currency)} of this contribution can still be reversed.`);
      return;
    }
    setReviewed(parsed.data);
  }
  async function save() {
    if (busy || !reviewed) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/contributions/${contributionId}/corrections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(reviewed),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(
          `${data.error || "The correction failed."} ${Object.values(data.fields ?? {})
            .flat()
            .join(" ")}`,
        );
        if (response.status >= 500) setRetryOnly(true);
        return;
      }
      // Saved: start a fresh entry and reload the totals and the list above.
      setDone(`Correction of ${money(reviewed.amount, currency)} recorded.`);
      requestId.current = null;
      setReviewed(null);
      setRetryOnly(false);
      form.current?.reset();
      router.refresh();
    } catch {
      setRetryOnly(true);
      setError("The result is uncertain. Retry the same correction safely, or reload this page to check first.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form ref={form} onSubmit={submit} className="mt-6 space-y-4 border-t border-base-300 pt-6">
      <h3 className="font-mono text-xs font-semibold">Record a correction</h3>
      <fieldset disabled={busy || !!reviewed} className="min-w-0 space-y-4">
        <div className="text-sm">
          <label htmlFor="correction-amount" className="block">
            Amount to reverse ({currency}) *
          </label>
          <input
            id="correction-amount"
            name="amount"
            inputMode="decimal"
            required
            aria-describedby="correction-amount-hint"
            className="input input-bordered mt-2 w-full"
            placeholder="0.00"
          />
          <p id="correction-amount-hint" className="mt-1 text-xs text-muted">
            Up to {money(remaining, currency)} can still be reversed.
          </p>
        </div>
        <label className="block text-sm">
          Reason for the correction *
          <textarea
            name="reason"
            required
            maxLength={2000}
            className="textarea textarea-bordered mt-2 min-h-24 w-full"
            placeholder="Refund, duplicate entry or recording mistake, with any reference."
          />
        </label>
      </fieldset>
      {reviewed && (
        <section className="space-y-3 border border-warning bg-warning/5 p-4" aria-label="Review correction">
          <h4 className="font-semibold">Confirm this correction</h4>
          <p className="text-sm">
            This adds a permanent entry of {money(`-${reviewed.amount}`, currency)} against the contribution, in the
            same period and with the same attribution. It cannot be edited or deleted.
          </p>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>
            {busy ? "Recording…" : retryOnly ? "Retry same correction" : "Confirm and record correction"}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy || retryOnly}
            onClick={() => setReviewed(null)}
          >
            Back to edit
          </button>
        </section>
      )}
      {error && (
        <p role="alert" className="whitespace-pre-wrap text-error">
          {error}
        </p>
      )}
      {done && <p role="status">{done}</p>}
      {!reviewed && (
        <button className="btn btn-primary" disabled={busy}>
          Review correction
        </button>
      )}
    </form>
  );
}

"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function ApproveTarget({ id, stamp }: { id: string; stamp: string }) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function approve() {
    if (busy || !confirmed) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/targets/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expected_updated_at: stamp }),
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) setError(result.error || "Approval failed.");
      else router.refresh();
    } catch {
      setError("Reload this plan to check whether approval completed before retrying.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-6 space-y-4 border border-warning bg-warning/5 p-5">
      <h2 className="text-lg font-semibold">Approve and lock</h2>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="checkbox"
          checked={confirmed}
          disabled={busy}
          onChange={e => setConfirmed(e.target.checked)}
        />
        I have reviewed the year, currency, all quarter baselines and employee/vertical allocations. Approval
        permanently fixes these targets.
      </label>
      <button className="btn btn-primary" disabled={!confirmed || busy} onClick={approve}>
        {busy ? "Approving…" : "Approve and lock targets"}
      </button>
      {error && (
        <p role="alert" className="text-error">
          {error}
        </p>
      )}
    </section>
  );
}

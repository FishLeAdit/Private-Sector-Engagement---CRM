"use client";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
export function MeetingStatus({ id, status }: { id: string; status: string }) {
  const label = useId(), router = useRouter();
  const [selected, setSelected] = useState(status), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function update() {
    if (busy || selected === status) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/meetings/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify({ status: selected }) });
      const data = await response.json(); if (!response.ok) setError(data.error || "Status could not be changed."); else router.refresh();
    } catch { setError("Status could not be changed. Please try again."); } finally { setBusy(false); }
  }
  return <div><label htmlFor={label} className="mb-2 block text-sm font-medium">Update meeting status</label><div className="flex gap-2"><select id={label} className="select select-bordered select-sm" disabled={busy} value={selected} onChange={event => setSelected(event.target.value)}><option value="scheduled">Scheduled</option><option value="done">Done</option><option value="cancelled">Cancelled</option></select><button type="button" className="btn btn-outline btn-sm" disabled={busy || selected === status} onClick={update}>{busy ? "Saving…" : "Save status"}</button></div>{error && <p role="alert" className="mt-2 text-sm text-error">{error}</p>}</div>;
}

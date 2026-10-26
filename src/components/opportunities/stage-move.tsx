"use client";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import type { Stage } from "@/features/opportunities/types";
export function StageMove({ id, stageId, stages }: { id: string; stageId: string; stages: Stage[] }) {
  const label = useId(), router = useRouter();
  const [selected, setSelected] = useState(stageId), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function move() {
    if (busy || selected === stageId) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/opportunities/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage_id: selected }), cache: "no-store" });
      const data = await response.json();
      if (!response.ok) setError(data.error || "Stage could not be changed.");
      else router.refresh();
    } catch { setError("Stage could not be changed. Please try again."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-2"><label htmlFor={label} className="block text-xs font-medium">Move to stage</label><div className="flex gap-2">
    <select id={label} value={selected} disabled={busy} onChange={event => setSelected(event.target.value)} className="select select-bordered select-sm min-w-0 flex-1">
      {stages.filter(stage => stage.active || stage.id === stageId).map(stage => <option key={stage.id} value={stage.id}>{stage.name}{!stage.active && " (inactive)"}</option>)}
    </select><button type="button" className="btn btn-outline btn-sm" disabled={busy || selected === stageId} onClick={move}>{busy ? "Moving…" : "Move"}</button></div>
    {error && <p role="alert" className="text-sm text-error">{error}</p>}
  </div>;
}

"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { MeetingOwner } from "@/features/meetings/types";
import { fromDhakaDateTimeInput } from "@/lib/dates";
export function FollowUpForm({ meetingId, userId, owners, manager }: { meetingId: string; userId: string; owners: MeetingOwner[]; manager: boolean }) {
  const router = useRouter();
  const [notes, setNotes] = useState(""), [owner, setOwner] = useState(userId), [time, setTime] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy) return; setError(""); setMessage("");
    if (!notes.trim()) { setError("Describe the follow-up task."); return; }
    const instant = time ? fromDhakaDateTimeInput(time) : "";
    if (time && !instant) { setError("Enter a valid task date and time."); return; }
    setBusy(true);
    try {
      const response = await fetch(`/api/meetings/${meetingId}/follow-ups`, { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify({ notes: notes.trim(), owner_id: owner, ...(instant ? { occurred_at: instant } : {}) }) });
      const data = await response.json();
      if (!response.ok) { setError(`${data.error || "Follow-up could not be saved."} ${Object.values(data.fields ?? {}).flat().join(" ")}`); return; }
      setNotes(""); setTime(""); setMessage("Follow-up task created."); router.refresh();
    } catch { setError("Follow-up could not be saved. Check your connection and try again."); } finally { setBusy(false); }
  }
  return <form onSubmit={save} className="mt-5 space-y-4"><fieldset disabled={busy} className="space-y-4"><legend className="sr-only">Create follow-up task</legend>
    <div><label htmlFor="follow-up-notes" className="mb-2 block text-sm font-medium">Follow-up task *</label><textarea id="follow-up-notes" className="textarea textarea-bordered min-h-28 w-full" maxLength={10000} value={notes} onChange={event => setNotes(event.target.value)} placeholder="For example, send the proposal and share meeting notes" /></div>
    <div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="follow-up-time" className="mb-2 block text-sm font-medium">Relevant date/time (optional, Asia/Dhaka)</label><input id="follow-up-time" type="datetime-local" className="input input-bordered w-full" value={time} onChange={event => setTime(event.target.value)} /></div>
      {manager && <div><label htmlFor="follow-up-owner" className="mb-2 block text-sm font-medium">Task owner</label><select id="follow-up-owner" className="select select-bordered w-full" value={owner} onChange={event => setOwner(event.target.value)}>{owners.filter(row => row.active).map(row => <option key={row.id} value={row.id}>{row.display_name}</option>)}</select></div>}</div>
    <p className="text-xs text-base-content/60">Creates an open task linked to this meeting and its saved contact/opportunity. {manager ? "Choose an active task owner." : "The task is assigned to you."}</p>
    <button className="btn btn-primary btn-sm" disabled={busy}>{busy ? "Creating…" : "Create follow-up task"}</button>
  </fieldset>{error && <p role="alert" className="text-sm text-error">{error}</p>}{message && <p role="status" className="text-sm text-success">{message}</p>}</form>;
}

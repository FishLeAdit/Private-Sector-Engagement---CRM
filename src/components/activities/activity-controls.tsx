"use client";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { activityStatuses, activityStatusLabels } from "@/features/activities/schemas";
import { ConfirmDeleteButton } from "@/components/ui/confirm-delete-button";

export function ActivityStatus({ id, status }: { id: string; status: string }) {
  const label = useId(),
    router = useRouter();
  const [selected, setSelected] = useState(status),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function save() {
    if (busy || selected === status) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/activities/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ status: selected }),
      });
      const data = await response.json();
      if (!response.ok)
        setError(
          `${data.error || "Status could not be saved."} ${Object.values(data.fields ?? {})
            .flat()
            .join(" ")}`,
        );
      else router.refresh();
    } catch {
      setError("Status could not be saved. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <label htmlFor={label} className="mb-2 block text-sm font-medium">
        Update activity status
      </label>
      <div className="flex gap-2">
        <select
          id={label}
          className="select select-bordered select-sm"
          value={selected}
          onChange={event => setSelected(event.target.value)}
          disabled={busy}
        >
          {activityStatuses.map(value => (
            <option key={value} value={value}>
              {activityStatusLabels[value]}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn-outline btn-sm" onClick={save} disabled={busy || status === selected}>
          {busy ? "Saving…" : "Save status"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function DeleteActivityButton({ id, title }: { id: string; title: string }) {
  return (
    <ConfirmDeleteButton
      noun="activity"
      name={title}
      endpoint={`/api/activities/${id}`}
      redirectTo="/activities?deleted=1"
      consequences="This permanently removes the activity. Audit history is retained. Linked contacts, opportunities, meetings and financial contributions are kept."
    />
  );
}

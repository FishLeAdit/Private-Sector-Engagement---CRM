"use client";
import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { activityStatuses, activityStatusLabels } from "@/features/activities/schemas";
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
  const dialog = useRef<HTMLDialogElement>(null),
    label = useId(),
    description = useId(),
    router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function remove() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/activities/${id}`, { method: "DELETE", cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Activity could not be deleted.");
        return;
      }
      dialog.current?.close();
      router.replace("/activities?deleted=1");
      router.refresh();
    } catch {
      setError("Activity could not be deleted. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        type="button"
        className="btn btn-error btn-outline"
        onClick={() => {
          setError("");
          dialog.current?.showModal();
        }}
      >
        Delete activity
      </button>
      <dialog
        ref={dialog}
        className="modal"
        aria-labelledby={label}
        aria-describedby={description}
        onCancel={event => {
          if (busy) event.preventDefault();
        }}
      >
        <div className="modal-box">
          <h2 id={label} className="text-xl font-bold">
            Delete activity?
          </h2>
          <p className="mt-4 break-words">
            You are about to delete <strong>{title}</strong>.
          </p>
          <p id={description} className="mt-3 text-sm text-base-content/70">
            This permanently removes the activity. Audit history is retained. Linked contacts, opportunities, meetings
            and financial contributions are kept.
          </p>
          {error && (
            <p role="alert" className="mt-4 text-sm text-error">
              {error}
            </p>
          )}
          <div className="modal-action">
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => dialog.current?.close()}>
              Cancel
            </button>
            <button type="button" className="btn btn-error" disabled={busy} onClick={remove}>
              {busy ? "Deleting…" : "Delete permanently"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}

"use client";
import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteOpportunityButton({ opportunityId, name }: { opportunityId: string; name: string }) {
  const dialog = useRef<HTMLDialogElement>(null),
    titleId = useId(),
    descriptionId = useId(),
    router = useRouter();
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  async function remove() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/opportunities/${opportunityId}`, { method: "DELETE", cache: "no-store" });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "Opportunity could not be deleted. Please try again.");
        return;
      }
      dialog.current?.close();
      router.replace("/opportunities?deleted=1");
      router.refresh();
    } catch {
      setError("Opportunity could not be deleted. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <button
        className="btn btn-error btn-outline"
        type="button"
        onClick={() => {
          setError("");
          dialog.current?.showModal();
        }}
      >
        Delete opportunity
      </button>
      <dialog
        ref={dialog}
        className="modal"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onCancel={event => {
          if (pending) event.preventDefault();
        }}
      >
        <div className="modal-box">
          <h2 id={titleId} className="text-xl font-bold">
            Delete opportunity?
          </h2>
          <p className="mt-4 break-words">
            You are about to delete <strong>{name}</strong>.
          </p>
          <p id={descriptionId} className="mt-3 text-sm leading-6 text-base-content/70">
            This permanently removes the opportunity. Audit history is retained. Opportunities with linked meetings,
            activities or recognized contributions cannot be deleted. Contacts are kept.
          </p>
          {error && (
            <p role="alert" className="mt-4 rounded-lg bg-error/10 p-3 text-sm text-error">
              {error}
            </p>
          )}
          <div className="modal-action">
            <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => dialog.current?.close()}>
              Cancel
            </button>
            <button type="button" className="btn btn-error" disabled={pending} onClick={remove}>
              {pending ? "Deleting…" : "Delete permanently"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}

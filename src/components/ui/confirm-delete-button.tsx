"use client";
import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  noun: string; // Lower-case record type, e.g. "contact".
  name: string; // The record being deleted, shown in the confirmation.
  endpoint: string;
  redirectTo: string;
  consequences: string;
};

// Permanent deletion behind a named confirmation. While the request is pending,
// both buttons are disabled and Escape cannot dismiss the dialog.
export function ConfirmDeleteButton({ noun, name, endpoint, redirectTo, consequences }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const Noun = noun[0].toUpperCase() + noun.slice(1);

  async function remove() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(endpoint, { method: "DELETE", cache: "no-store" });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || `${Noun} could not be deleted. Please try again.`);
        return;
      }
      dialog.current?.close();
      router.replace(redirectTo);
      router.refresh();
    } catch {
      setError(`${Noun} could not be deleted. Check your connection and try again.`);
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
        Delete {noun}
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
            Delete {noun}?
          </h2>
          <p className="mt-4 break-words">
            You are about to delete <strong>{name}</strong>.
          </p>
          <p id={descriptionId} className="mt-3 text-sm leading-6 text-base-content/70">
            {consequences}
          </p>
          {error && (
            <p role="alert" className="mt-4 border-l-2 border-error bg-error/5 p-3 text-sm text-error">
              {error}
            </p>
          )}
          <div className="modal-action">
            <button className="btn btn-ghost" type="button" disabled={pending} onClick={() => dialog.current?.close()}>
              Cancel
            </button>
            <button className="btn btn-error" type="button" disabled={pending} onClick={remove}>
              {pending ? "Deleting…" : "Delete permanently"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}

"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteContactButton({ contactId, name }: { contactId: string; name: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    if (pending) return;
    setPending(true); setError("");
    try {
      const response = await fetch(`/api/contacts/${contactId}`, { method: "DELETE", cache: "no-store" });
      const result = await response.json();
      if (!response.ok) { setError(result.error || "Contact could not be deleted. Please try again."); return; }
      dialog.current?.close();
      router.replace("/contacts?deleted=1");
      router.refresh();
    } catch {
      setError("Contact could not be deleted. Check your connection and try again.");
    } finally { setPending(false); }
  }

  return <>
    <button className="btn btn-error btn-outline" type="button" onClick={() => { setError(""); dialog.current?.showModal(); }}>Delete contact</button>
    <dialog ref={dialog} className="modal" aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={event => { if (pending) event.preventDefault(); }}>
      <div className="modal-box">
        <h2 id={titleId} className="text-xl font-bold">Delete contact?</h2>
        <p className="mt-4 break-words">You are about to delete <strong>{name}</strong>.</p>
        <p id={descriptionId} className="mt-3 text-sm leading-6 text-base-content/70">This permanently removes the contact. Audit history is retained. Linked records must be reassigned or unlinked before deletion.</p>
        {error && <p role="alert" className="mt-4 rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p>}
        <div className="modal-action">
          <button className="btn btn-ghost" type="button" disabled={pending} onClick={() => dialog.current?.close()}>Cancel</button>
          <button className="btn btn-error" type="button" disabled={pending} onClick={remove}>{pending ? "Deleting…" : "Delete permanently"}</button>
        </div>
      </div>
    </dialog>
  </>;
}

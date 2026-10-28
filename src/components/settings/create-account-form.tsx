"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ProfileFields, sendAccount } from "./account-fields";

// A new sign-in account with its profile. The password is set here and can be changed later.
export function CreateAccountForm({ disabled }: { disabled: boolean }) {
  const router = useRouter(),
    form = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setDone("");
    const problem = await sendAccount("/api/accounts", "POST", {
      email: data.get("email"),
      password: data.get("password"),
      display_name: data.get("display_name"),
      department: data.get("department"),
      role: data.get("role"),
    });
    setBusy(false);
    if (problem) return setError(problem);
    setDone(`Account created for ${data.get("display_name")}.`);
    form.current?.reset();
    setOpen(false);
    router.refresh();
  }
  return (
    <div className="mb-6 max-w-3xl">
      {done && (
        <p role="status" className="mb-3">
          {done}
        </p>
      )}
      {!open ? (
        <button type="button" className="btn btn-primary" disabled={disabled} onClick={() => setOpen(true)}>
          New account
        </button>
      ) : (
        <form ref={form} onSubmit={submit} className="space-y-4 panel p-6" aria-label="New account">
          <h2 className="font-mono text-sm font-semibold">New account</h2>
          <fieldset disabled={busy} className="grid min-w-0 gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              Email *
              <input name="email" type="email" required maxLength={254} className="input input-bordered mt-2 w-full" />
            </label>
            <label className="block text-sm">
              Initial password *
              <input
                name="password"
                type="password"
                required
                minLength={8}
                maxLength={72}
                autoComplete="new-password"
                className="input input-bordered mt-2 w-full"
              />
            </label>
            <ProfileFields />
          </fieldset>
          <p className="text-xs text-muted">
            The account can sign in straight away with this password; no email is sent. Share it privately.
          </p>
          {error && (
            <p role="alert" className="text-error">
              {error}
            </p>
          )}
          <div className="flex gap-3">
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "Creating…" : "Create account"}
            </button>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

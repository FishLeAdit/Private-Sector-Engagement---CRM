"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Account } from "@/features/accounts/types";
import { ProfileFields, sendAccount } from "./account-fields";

// Profile and access for one account: name, department, role, and whether it may sign in (restricting it ends
// CRM access on its next request). A superadmin cannot remove their own access.
export function AccountEditor({ account, self }: { account: Account; self: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setDone("");
    const problem = await sendAccount(`/api/accounts/${account.id}`, "PATCH", {
      display_name: data.get("display_name"),
      department: self ? "PSE" : data.get("department"),
      role: self ? "admin" : data.get("role"),
      active: self || data.has("active"),
    });
    setBusy(false);
    if (problem) return setError(problem);
    setDone("Account saved.");
    router.refresh();
  }
  return (
    <form onSubmit={submit} className="space-y-4 panel p-6" aria-label="Profile and access">
      <h2 className="font-mono text-sm font-semibold">
        {account.display_name ? "Profile and access" : "Create profile"}
      </h2>
      <fieldset disabled={busy} className="min-w-0 space-y-4">
        <ProfileFields
          lockAccess={self}
          values={
            account.display_name
              ? {
                  display_name: account.display_name,
                  department: account.department ?? "PSE",
                  role: account.role ?? "pse_member",
                }
              : undefined
          }
        />
        <label className="flex items-start gap-3 text-sm">
          <input
            name="active"
            type="checkbox"
            className="checkbox mt-0.5"
            defaultChecked={account.active ?? true}
            disabled={self}
          />
          <span>
            Active
            <span className="block text-xs text-muted">
              Clear this to restrict the account: it keeps its history but can no longer use the CRM.
            </span>
          </span>
        </label>
      </fieldset>
      {self && (
        <p className="text-xs text-muted">
          This is your account: you can rename it, but not remove your own superadmin access.
        </p>
      )}
      {error && (
        <p role="alert" className="text-error">
          {error}
        </p>
      )}
      {done && <p role="status">{done}</p>}
      <button className="btn btn-primary" disabled={busy}>
        {busy ? "Saving…" : "Save account"}
      </button>
    </form>
  );
}

export function PasswordForm({ id, disabled }: { id: string; disabled: boolean }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    setBusy(true);
    setError("");
    setDone("");
    const problem = await sendAccount(`/api/accounts/${id}/password`, "POST", {
      password: new FormData(form).get("password"),
    });
    setBusy(false);
    if (problem) return setError(problem);
    form.reset();
    setDone("Password changed. Share it privately; existing sessions stay signed in.");
  }
  return (
    <form onSubmit={submit} className="space-y-4 panel p-6" aria-label="Password">
      <h2 className="font-mono text-sm font-semibold">Password</h2>
      <label className="block text-sm">
        New password *
        <input
          name="password"
          type="password"
          required
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          disabled={disabled || busy}
          className="input input-bordered mt-2 w-full"
        />
      </label>
      {error && (
        <p role="alert" className="text-error">
          {error}
        </p>
      )}
      {done && <p role="status">{done}</p>}
      <button className="btn btn-outline" disabled={disabled || busy}>
        {busy ? "Changing…" : "Set password"}
      </button>
    </form>
  );
}

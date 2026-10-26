"use client";

import { useActionState } from "react";
import { signOutAction } from "@/app/(auth)/actions";

export function LogoutButton() {
  const [state, action, pending] = useActionState(signOutAction, { error: "" });
  return <form action={action}>
    <button className="btn btn-outline btn-sm" type="submit" disabled={pending}>{pending ? "Signing out…" : "Sign out"}</button>
    {state.error && <p className="mt-2 text-sm text-error" role="alert">{state.error}</p>}
  </form>;
}

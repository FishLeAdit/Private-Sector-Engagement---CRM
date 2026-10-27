"use client";

import { useActionState } from "react";
import { signInAction } from "@/app/(auth)/actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signInAction, { error: "" });
  return (
    <form action={action} className="mt-8 space-y-5">
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="mb-2 block text-sm font-medium" htmlFor="email">
          Email address
        </label>
        <input
          className="input input-bordered w-full"
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          maxLength={254}
          required
          disabled={pending}
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium" htmlFor="password">
          Password
        </label>
        <input
          className="input input-bordered w-full"
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          maxLength={4096}
          required
          disabled={pending}
        />
      </div>
      {state.error && (
        <p className="text-sm text-error" role="alert">
          {state.error}
        </p>
      )}
      <button className="btn btn-primary w-full" type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

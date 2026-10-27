"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
export function RefreshReport() {
  const router = useRouter();
  const [pending, start] = useTransition(),
    [error, setError] = useState("");
  function refresh() {
    if (pending) return;
    setError("");
    start(async () => {
      try {
        const response = await fetch("/api/reports/refresh", { method: "POST", cache: "no-store" });
        if (!response.ok) {
          setError("Refresh failed. Check your sign-in and try again.");
          return;
        }
        router.refresh();
      } catch {
        setError("Refresh failed. Check your connection and try again.");
      }
    });
  }
  return (
    <div>
      <button type="button" className="btn btn-outline btn-sm" disabled={pending} onClick={refresh}>
        {pending ? "Refreshing…" : "Refresh data"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-xs text-error">
          {error}
        </p>
      )}
    </div>
  );
}

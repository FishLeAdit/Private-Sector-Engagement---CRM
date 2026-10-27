"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { duplicateCheckSchema, normalizeEmail, normalizePhone } from "@/features/contacts/schemas";
import type { DuplicateContact } from "@/features/contacts/types";

// Looks up existing contacts with the same normalized email or phone, 400 ms after typing stops.
// Results are tied to the email/phone they were checked for, so stale answers never show.
export function useDuplicateCheck(email: string, phone: string, contactId?: string) {
  const key = `${normalizeEmail(email) ?? ""}|${normalizePhone(phone) ?? ""}`;
  const [checked, setChecked] = useState<{ key: string; matches: DuplicateContact[]; error: string }>({
    key: "",
    matches: [],
    error: "",
  });

  useEffect(() => {
    const input = duplicateCheckSchema.safeParse({ email, phone, exclude: contactId });
    if (!input.success || key === "|") return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/contacts/duplicates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input.data),
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Check unavailable");
        const data = await response.json();
        if (!controller.signal.aborted) setChecked({ key, matches: data.duplicates, error: "" });
      } catch {
        if (!controller.signal.aborted)
          setChecked({ key, matches: [], error: "Could not check for existing contacts. You can still try saving." });
      }
    }, 400);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [email, phone, key, contactId]);

  return {
    matches: checked.key === key ? checked.matches : [],
    checkError: checked.key === key ? checked.error : "",
    // A save rejected by the server as a duplicate reports its matches directly.
    showMatches: (matches: DuplicateContact[]) => setChecked({ key, matches, error: "" }),
  };
}

export function DuplicateWarning({ matches, checkError }: { matches: DuplicateContact[]; checkError: string }) {
  return (
    <>
      {matches.length > 0 && (
        <div role="alert" className="rounded-lg border border-warning bg-warning/10 p-4 text-sm">
          <p className="font-semibold">Possible duplicate contact</p>
          <ul className="mt-2 space-y-1">
            {matches.map(match => (
              <li key={match.id}>
                <Link href={`/contacts/${match.id}`} target="_blank" rel="noreferrer" className="link">
                  {match.name}
                </Link>{" "}
                — matching {match.fields.join(" and ")}
              </li>
            ))}
          </ul>
          <p className="mt-2">Review the existing contact or use different contact details.</p>
        </div>
      )}
      {checkError && (
        <p role="status" className="text-sm text-base-content/70">
          {checkError}
        </p>
      )}
    </>
  );
}

import type { Json } from "@/types/database.types";
import { formatDate } from "@/lib/dates";

export type AuditEntry = {
  id: string;
  action: string;
  before: Json | null;
  after: Json | null;
  created_at: string;
  actor: { display_name: string } | null;
};

type Props<A extends AuditEntry> = {
  audits: A[];
  note: string; // Explains the window shown, e.g. "Latest 20 meeting audit entries."
  describe: (audit: A) => string; // One-line summary such as "Status: Scheduled → Done".
  className?: string;
};

export function AuditHistory<A extends AuditEntry>({ audits, note, describe, className = "" }: Props<A>) {
  return (
    <section className={`rounded-xl border border-base-300 p-6 ${className}`}>
      <h2 className="text-lg font-semibold">Recent changes</h2>
      <p className="mt-2 text-xs text-base-content/60">{note}</p>
      <ul className="mt-5 space-y-4">
        {audits.map(audit => (
          <li key={audit.id} className="text-sm">
            <p className="font-medium">{describe(audit)}</p>
            <p className="mt-1 text-base-content/60">
              {audit.actor?.display_name ?? "System or unavailable user"} · {formatDate(audit.created_at, true)}
            </p>
          </li>
        ))}
      </ul>
      {!audits.length && <p className="mt-4 text-sm">No changes recorded.</p>}
    </section>
  );
}

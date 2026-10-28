import { SysCode } from "./hud";

// Page-level building blocks shared by the list and detail pages.

// Title, one-line description and the page's main actions, at the top of a list page.
export function ListHeader({
  title,
  description,
  code,
  children,
}: {
  title: string;
  description: string;
  code?: string; // Decorative system string from real context, e.g. "SYS.CON // 13 RECORDS".
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {code && <SysCode className="mb-1 block">{code}</SysCode>}
        <h1 className="font-mono text-2xl font-semibold sm:text-3xl">{title}</h1>
        <p className="mt-2 text-muted">{description}</p>
      </div>
      {children}
    </div>
  );
}

// Confirms the outcome of the previous action, e.g. "Meeting deleted successfully."
export function StatusNotice({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="mb-5 border-l-2 border-success bg-success/5 p-4 text-success">
      {children}
    </p>
  );
}

// Shown on a detail page after the form redirects with ?saved=created or ?saved=updated.
export function SavedNotice({ saved, noun }: { saved?: string; noun: string }) {
  if (saved !== "created" && saved !== "updated") return null;
  return (
    <StatusNotice>
      {noun} {saved} successfully.
    </StatusNotice>
  );
}

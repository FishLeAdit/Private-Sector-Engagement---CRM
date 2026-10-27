// Page-level building blocks shared by the list and detail pages.

// Title, one-line description and the page's main actions, at the top of a list page.
export function ListHeader({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="mt-2 text-base-content/65">{description}</p>
      </div>
      {children}
    </div>
  );
}

// Confirms the outcome of the previous action, e.g. "Meeting deleted successfully."
export function StatusNotice({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="mb-5 rounded-lg bg-success/10 p-4 text-success">
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

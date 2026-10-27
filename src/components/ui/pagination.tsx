import Link from "next/link";

type Props = {
  summary: string; // e.g. "12 matching deals"
  page: number;
  pages: number;
  label: string; // Accessible name for the page navigation, e.g. "Opportunity pages".
  href: (page: number) => string;
};

// Footer for server-rendered lists: a result summary and Previous/Next links that keep the current filters.
export function Pagination({ summary, page, pages, label, href }: Props) {
  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
      <p>
        {summary} · Page {page} of {pages}
      </p>
      <nav aria-label={label} className="flex gap-2">
        {page > 1 && (
          <Link href={href(page - 1)} className="btn btn-outline btn-sm">
            Previous
          </Link>
        )}
        {page < pages && (
          <Link href={href(page + 1)} className="btn btn-outline btn-sm">
            Next
          </Link>
        )}
      </nav>
    </div>
  );
}

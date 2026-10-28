import Link from "next/link";
import { activityTitle, activityTypeLabels } from "@/features/activities/schemas";
import type { OverviewData, Panel } from "@/features/overview/context";
import { formatDate } from "@/lib/dates";
import { money } from "@/lib/money";
import { Notice, SysCode } from "@/components/ui/hud";

type Row = { key: string; href: string; title: string; meta: string; aside?: string };

const QUEUE_SIZE = 5; // Rows per panel; "View all" opens the full filtered list.

// One list panel: a count, the first few records, and a link to the full filtered list. A panel that
// failed to load says so without hiding the others.
function QueuePanel({
  title,
  code,
  panel,
  rows,
  total,
  href,
  empty,
}: {
  title: string;
  code: string;
  panel: Panel<unknown>;
  rows: Row[];
  total: number;
  href: string;
  empty: string;
}) {
  return (
    <section aria-label={title} className="panel min-w-0 p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <SysCode className="block">{code}</SysCode>
          <h3 className="mt-1 font-mono text-xs font-semibold">
            {title}
            {panel.ok && <span className="ml-2 text-muted">{total}</span>}
          </h3>
        </div>
        <Link href={href} className="link font-mono text-[0.7rem] uppercase tracking-wider">
          View all
        </Link>
      </div>
      {!panel.ok ? (
        <Notice tone="warning" role="alert">
          {panel.message}
        </Notice>
      ) : !rows.length ? (
        <p className="py-4 font-mono text-xs uppercase tracking-wider text-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-base-300">
          {rows.slice(0, QUEUE_SIZE).map(row => (
            <li key={row.key} className="flex items-baseline justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <Link href={row.href} className="link link-hover block truncate text-sm font-medium">
                  {row.title}
                </Link>
                <p className="mt-0.5 truncate text-xs text-muted">{row.meta}</p>
              </div>
              {row.aside && <span className="shrink-0 font-mono text-xs tabular-nums">{row.aside}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const rowsOf = <T,>(panel: Panel<T>, map: (data: T) => Row[]) => (panel.ok ? map(panel.data) : []);

// The signed-in user's next meetings and open work, then the team's latest receipts and deals closing soon.
export function OverviewQueue({ data }: { data: OverviewData }) {
  const { me, closingWindow } = data;
  const meetings = rowsOf(data.upcoming, d =>
    d.meetings.map(m => ({
      key: m.id,
      href: `/meetings/${m.id}`,
      title: m.title,
      meta: m.contact?.name ?? m.opportunity?.deal_name ?? "No contact",
      aside: formatDate(m.scheduled_at, true),
    })),
  );
  const work = rowsOf(data.openWork, d =>
    d.activities.map(a => ({
      key: a.id,
      href: `/activities/${a.id}`,
      title: activityTitle(a),
      meta: activityTypeLabels[a.activity_type as keyof typeof activityTypeLabels] ?? a.activity_type,
      aside: formatDate(a.occurred_at ?? a.created_at),
    })),
  );
  const receipts = rowsOf(data.receipts, d =>
    d.contributions.map(c => ({
      key: c.id,
      href: `/contributions/${c.id}`,
      title: `${money(c.amount, c.currency)}${c.corrects_contribution_id ? " correction" : ""}`,
      meta: `${c.opportunity?.deal_name ?? "Opportunity"} · ${c.employee?.display_name ?? "Employee"}`,
      aside: formatDate(c.recognized_at),
    })),
  );
  const closing = rowsOf(data.closing, d =>
    d.map(o => ({
      key: o.id,
      href: `/opportunities/${o.id}`,
      title: o.deal_name,
      meta: `${money(o.expected_amount, o.currency)} expected · ${o.stage?.name ?? "Stage"}`,
      aside: formatDate(o.expected_close_at),
    })),
  );
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <QueuePanel
        title="My upcoming meetings"
        code="MTG-Q"
        panel={data.upcoming}
        rows={meetings}
        total={data.upcoming.ok ? data.upcoming.data.count : 0}
        href={`/meetings?period=upcoming&owner_id=${me}`}
        empty="No upcoming meetings."
      />
      <QueuePanel
        title="My open activities"
        code="ACT-Q"
        panel={data.openWork}
        rows={work}
        total={data.openWork.ok ? data.openWork.data.count : 0}
        href={`/activities?status=open&owner_id=${me}`}
        empty="No open activities."
      />
      <QueuePanel
        title="Recent contributions"
        code="RCV-Q"
        panel={data.receipts}
        rows={receipts}
        total={data.receipts.ok ? data.receipts.data.count : 0}
        href="/contributions"
        empty="No contributions recorded yet."
      />
      <QueuePanel
        title="Deals closing in 30 days"
        code="OPP-Q"
        panel={data.closing}
        rows={closing}
        total={closing.length}
        href={`/opportunities?from=${closingWindow.from}&to=${closingWindow.to}`}
        empty="No open deals are expected to close in the next 30 days."
      />
    </div>
  );
}

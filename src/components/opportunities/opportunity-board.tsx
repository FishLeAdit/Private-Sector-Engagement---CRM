import Link from "next/link";
import { BOARD_CARDS, BOARD_MAX, BOARD_STEP, type BoardColumn, type Totals } from "@/features/opportunities/board";
import type { OpportunityRecord, Stage } from "@/features/opportunities/types";
import { formatDate } from "@/lib/dates";
import { formatCents, money } from "@/lib/money";
import { StageMove } from "./stage-move";

export const totalsText = (totals: Totals) =>
  [...totals].map(([currency, total]) => formatCents(total, currency)).join(" · ");

// Every matching deal by stage. Counts and expected totals cover all of them; each stage lists its latest cards,
// and "Show more" raises that stage's limit. Past the board's limit the list view, filtered to the stage, has the rest.
export function OpportunityBoard({
  columns,
  stages,
  canMove,
  moreHref,
  stageListHref,
}: {
  columns: BoardColumn[];
  stages: Stage[];
  canMove: (row: OpportunityRecord) => boolean;
  moreHref: (stageId: string, limit: number) => string;
  stageListHref: (stageId: string) => string;
}) {
  return (
    <>
      <p className="mb-3 text-sm text-muted">
        Every matching deal, grouped by stage. Counts and expected totals cover them all; each stage lists its latest{" "}
        {BOARD_CARDS} first.
      </p>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map(({ stage, deals, count, totals, limit }) => {
          const hidden = count - deals.length;
          return (
            <section key={stage.id} aria-labelledby={`stage-${stage.id}`} className="w-72 shrink-0 panel p-3">
              <h2 id={`stage-${stage.id}`} className="mb-1 font-semibold">
                {stage.name} <span className="badge badge-sm">{count}</span>
              </h2>
              <p className="text-xs text-muted">
                {stage.is_provisional ? "Provisional · " : ""}
                {stage.outcome ?? "Open"}
                {!stage.active && " · inactive"}
              </p>
              <p className="mb-4 mt-1 text-xs">{count ? `${totalsText(totals)} expected` : "No deals"}</p>
              <div className="space-y-3">
                {deals.map(row => (
                  <article key={row.id} className="space-y-3 border border-base-300 bg-base-100/60 p-4">
                    <Link className="link link-hover font-semibold" href={`/opportunities/${row.id}`}>
                      {row.deal_name}
                    </Link>
                    <p className="text-sm">{money(row.expected_amount, row.currency)}</p>
                    <p className="text-xs text-muted">
                      {row.contact?.name} · {row.owner?.display_name}
                      <br />
                      Closing: {formatDate(row.expected_close_at)}
                    </p>
                    {canMove(row) && (
                      <StageMove key={`${row.id}:${row.stage_id}`} id={row.id} stageId={row.stage_id} stages={stages} />
                    )}
                  </article>
                ))}
                {!count && <p className="py-6 text-center text-sm text-muted">No matching deals in this stage.</p>}
                {hidden > 0 && (
                  <div className="space-y-2 text-center text-xs">
                    <p className="text-muted">
                      Showing {deals.length} of {count}
                    </p>
                    {limit < BOARD_MAX ? (
                      <Link
                        className="btn btn-outline btn-sm"
                        href={moreHref(stage.id, limit + BOARD_STEP)}
                        scroll={false}
                      >
                        Show {Math.min(BOARD_STEP, hidden)} more <span className="sr-only">in {stage.name}</span>
                      </Link>
                    ) : (
                      <Link className="link" href={stageListHref(stage.id)}>
                        See all {count} <span className="sr-only">{stage.name} deals</span> in the list
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

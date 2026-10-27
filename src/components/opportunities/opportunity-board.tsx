import Link from "next/link";
import type { OpportunityRecord, Stage } from "@/features/opportunities/types";
import { formatDate } from "@/lib/dates";
import { money } from "@/lib/money";
import { StageMove } from "./stage-move";

// Groups the current page of deals by stage. Inactive stages appear only while a deal on this page uses them.
export function OpportunityBoard({
  rows,
  stages,
  canMove,
}: {
  rows: OpportunityRecord[];
  stages: Stage[];
  canMove: (row: OpportunityRecord) => boolean;
}) {
  return (
    <>
      <p className="mb-3 text-sm text-base-content/65">
        This board groups the current page of up to 20 deals. Use pagination to see the rest.
      </p>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages
          .filter(stage => stage.active || rows.some(row => row.stage_id === stage.id))
          .map(stage => {
            const deals = rows.filter(row => row.stage_id === stage.id);
            return (
              <section key={stage.id} className="w-72 shrink-0 rounded-xl bg-base-200 p-3">
                <h2 className="mb-1 font-semibold">
                  {stage.name} <span className="badge badge-sm">{deals.length}</span>
                </h2>
                <p className="mb-4 text-xs text-base-content/60">
                  {stage.is_provisional ? "Provisional · " : ""}
                  {stage.outcome ?? "Open"}
                  {!stage.active && " · inactive"}
                </p>
                <div className="space-y-3">
                  {deals.map(row => (
                    <article key={row.id} className="space-y-3 rounded-lg border border-base-300 bg-base-100 p-4">
                      <Link className="link link-hover font-semibold" href={`/opportunities/${row.id}`}>
                        {row.deal_name}
                      </Link>
                      <p className="text-sm">{money(row.expected_amount, row.currency)}</p>
                      <p className="text-xs text-base-content/65">
                        {row.contact?.name} · {row.owner?.display_name}
                        <br />
                        Closing: {formatDate(row.expected_close_at)}
                      </p>
                      {canMove(row) && (
                        <StageMove
                          key={`${row.id}:${row.stage_id}`}
                          id={row.id}
                          stageId={row.stage_id}
                          stages={stages}
                        />
                      )}
                    </article>
                  ))}
                  {!deals.length && (
                    <p className="py-6 text-center text-sm text-base-content/60">No deals on this page.</p>
                  )}
                </div>
              </section>
            );
          })}
      </div>
    </>
  );
}

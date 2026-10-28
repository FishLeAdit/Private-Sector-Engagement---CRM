import Link from "next/link";
import { notFound } from "next/navigation";
import type { Json } from "@/types/database.types";
import { acceptsContributions } from "@/features/contributions/service";
import { opportunityPageContext, opportunityPageData } from "@/features/opportunities/context";
import { canEditOpportunity } from "@/features/opportunities/service";
import { DeleteOpportunityButton } from "@/components/opportunities/delete-opportunity-button";
import {
  OpportunityContacts,
  OpportunityContributions,
  OpportunityReferences,
  OpportunitySummary,
} from "@/components/opportunities/opportunity-details";
import { OpportunityProblem } from "@/components/opportunities/opportunity-state";
import { AuditHistory } from "@/components/ui/audit-history";
import { RecordStatus } from "@/components/ui/record-status";
import { SavedNotice } from "@/components/ui/page";
import { SysCode } from "@/components/ui/hud";

// Audit snapshots are raw rows; only the stage is read here to describe stage moves.
function stageId(value: Json) {
  return value && typeof value === "object" && !Array.isArray(value) && typeof value.stage_id === "string"
    ? value.stage_id
    : null;
}

export default async function OpportunityDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { access, service } = await opportunityPageContext();
  const { id } = await params;
  const result = await opportunityPageData(() => Promise.all([service.details(id), service.options()]));
  if (!result.ok) {
    if ([400, 404].includes(result.error.status)) notFound();
    return <OpportunityProblem message={result.error.message} />;
  }
  const [{ opportunity: row, history }, options] = result.data;
  const editable = canEditOpportunity(access, row);
  const saved = (await searchParams).saved;
  const stageName = (id: string | null) => options.stages.find(stage => stage.id === id)?.name ?? "Unknown stage";
  return (
    <>
      <Link href="/opportunities" className="link text-sm">
        ← Opportunities
      </Link>
      <div className="mb-6 mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <SysCode className="mb-1 block">{`SYS.OPP // ${id.slice(0, 8).toUpperCase()}`}</SysCode>
          <p className="mb-2 flex flex-wrap items-center gap-2 text-sm text-muted">
            <RecordStatus status={row.stage?.outcome ?? "open"} label={row.stage?.name ?? "No stage"} />
            {row.stage?.is_provisional && <span>· provisional stage</span>}
          </p>
          <h1 className="break-words text-3xl font-bold">{row.deal_name}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {acceptsContributions(row.stage) && (
            <Link href={`/contributions/new?opportunity_id=${id}`} className="btn btn-primary">
              Record contribution
            </Link>
          )}
          <Link href={`/contributions?opportunity_id=${id}`} className="btn btn-ghost">
            View contributions
          </Link>
          <Link href={`/activities/new?opportunity_id=${id}`} className="btn btn-outline">
            Log activity
          </Link>
          <Link href={`/activities?opportunity_id=${id}`} className="btn btn-ghost">
            View direct activities
          </Link>
          <Link href={`/meetings/new?opportunity_id=${id}`} className="btn btn-primary">
            Schedule meeting
          </Link>
          <Link href={`/meetings?opportunity_id=${id}`} className="btn btn-ghost">
            View meetings
          </Link>
          {editable && (
            <>
              <Link href={`/opportunities/${id}/edit`} className="btn btn-outline">
                Edit deal
              </Link>
              <DeleteOpportunityButton opportunityId={id} name={row.deal_name} />
            </>
          )}
        </div>
      </div>
      <SavedNotice saved={saved} noun="Deal" />
      <div className="grid gap-6 lg:grid-cols-2">
        <OpportunitySummary row={row} editable={editable} stages={options.stages} />
        <OpportunityContacts row={row} />
        <OpportunityReferences row={row} />
        <OpportunityContributions contributions={history.contributions} />
      </div>
      <AuditHistory
        className="mt-6"
        audits={history.audits}
        note="Latest 20 audit entries. Stage names use the current configuration. Dates use Asia/Dhaka."
        describe={audit => {
          const before = stageId(audit.before);
          const after = stageId(audit.after);
          if (audit.action === "insert") return `Deal created in ${stageName(after)}`;
          if (before !== after) return `Stage: ${stageName(before)} → ${stageName(after)}`;
          return "Deal details updated";
        }}
      />
    </>
  );
}

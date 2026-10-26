import Link from "next/link";
import { notFound } from "next/navigation";
import { opportunityPageContext, opportunityPageData } from "@/features/opportunities/context";
import { canEditOpportunity, opportunityValues } from "@/features/opportunities/service";
import { isPseManager } from "@/lib/auth/roles";
import { OpportunityForm } from "@/components/opportunities/opportunity-form";
import { OpportunityProblem } from "@/components/opportunities/opportunity-state";
export default async function EditOpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { access, service } = await opportunityPageContext(); const { id } = await params;
  const result = await opportunityPageData(() => Promise.all([service.get(id), service.options()]));
  if (!result.ok) { if ([400, 404].includes(result.error.status)) notFound(); return <OpportunityProblem message={result.error.message} />; }
  const [row, options] = result.data;
  if (!canEditOpportunity(access, row)) return <OpportunityProblem message="Only the focal person, creator or an authorized manager may edit this deal." />;
  const formOptions = options.owners.some(owner => owner.id === row.owner_id) ? options : { ...options, owners: [...options.owners, { id: row.owner_id, display_name: row.owner?.display_name ?? "Former focal person", active: false }] };
  return <><Link href={`/opportunities/${id}`} className="link text-sm">← Deal details</Link><h1 className="mb-7 mt-4 text-3xl font-bold">Edit deal</h1><OpportunityForm opportunityId={id} initial={opportunityValues(row)} contacts={{ contact_id: row.contact, primary_contact_id: row.primary_contact, secondary_contact_id: row.secondary_contact }} options={formOptions} manager={isPseManager(access.profile)} userId={access.userId} /></>;
}

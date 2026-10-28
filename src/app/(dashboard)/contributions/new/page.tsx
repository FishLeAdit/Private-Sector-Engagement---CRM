import Link from "next/link";
import { contributionPage } from "@/features/contributions/context";
import { acceptsContributions } from "@/features/contributions/service";
import { financeData } from "@/features/finance/context";
import { ContributionForm } from "@/components/contributions/contribution-form";
import { FinanceProblem } from "@/components/finance/problem";
import { isPseManager } from "@/lib/auth/roles";
import { SysCode } from "@/components/ui/hud";
export default async function Page({ searchParams }: { searchParams: Promise<{ opportunity_id?: string }> }) {
  const { service, access } = await contributionPage();
  const { id } = { id: (await searchParams).opportunity_id };
  if (!id)
    return (
      <>
        <SysCode className="mb-1 block">{"SYS.RCV // NEW"}</SysCode>
        <h1 className="text-3xl font-bold">Record a contribution</h1>
        <p className="my-5">Open an opportunity and choose Record contribution to enter actual received support.</p>
        <Link href="/opportunities" className="btn btn-primary">
          Choose opportunity
        </Link>
      </>
    );
  const result = await financeData(() => Promise.all([service.opportunity(id), service.options()]));
  if (!result.ok) return <FinanceProblem message={result.error.message} />;
  const [opportunity, options] = result.data;
  return (
    <>
      <Link href={`/opportunities/${id}`} className="link text-sm">
        ← Opportunity
      </Link>
      <SysCode className="mt-4 mb-1 block">{"SYS.RCV // NEW"}</SysCode>
      <h1 className="mb-7 text-3xl font-bold">Record contribution</h1>
      {acceptsContributions(opportunity.stage) ? (
        <ContributionForm
          opportunity={opportunity}
          options={options}
          userId={access.userId}
          manager={isPseManager(access.profile)}
        />
      ) : (
        <p role="alert" className="max-w-3xl border-l-2 border-warning bg-warning/5 p-4">
          {opportunity.deal_name} is {opportunity.stage?.name}. Contributions can only be recorded on open or won deals;
          receipts recorded before the deal closed stay counted.
        </p>
      )}
    </>
  );
}

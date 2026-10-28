import Link from "next/link";
import { notFound } from "next/navigation";
import { contributionPage } from "@/features/contributions/context";
import { financeData } from "@/features/finance/context";
import { FinanceProblem } from "@/components/finance/problem";
import { ContributionCorrections } from "@/components/contributions/corrections";
import { isPseManager } from "@/lib/auth/roles";
import { money } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { Notice, SysCode } from "@/components/ui/hud";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { service, access } = await contributionPage();
  const { id } = await params;
  const loaded = await financeData(() => Promise.all([service.contribution(id), service.corrections(id)]));
  if (!loaded.ok) {
    if ([400, 404].includes(loaded.error.status)) notFound();
    return <FinanceProblem message={loaded.error.message} />;
  }
  const [row, corrections] = loaded.data;
  // A correction is a negative entry pointing at the receipt it reverses (migration 0015).
  const original = row.corrects_contribution_id;
  return (
    <>
      <Link href="/contributions" className="link text-sm">
        ← Contributions
      </Link>
      <SysCode className="mt-4 mb-1 block">{`SYS.RCV // ${id.slice(0, 8).toUpperCase()}`}</SysCode>
      <h1 className="mb-6 text-3xl font-bold">
        {money(row.amount, row.currency)} {original ? "correction" : "recognized"}
      </h1>
      <section className="max-w-3xl space-y-5 panel p-6">
        {original && (
          <Notice tone="warning">
            Correction entry. It reverses part or all of{" "}
            <Link className="link" href={`/contributions/${original}`}>
              the original contribution
            </Link>{" "}
            and keeps its attribution and recognition time, so reports net it in the same period.
          </Notice>
        )}
        <Link href={`/opportunities/${row.opportunity_id}`} className="link font-medium">
          {row.opportunity?.deal_name ?? "Opportunity"}
        </Link>
        <dl className="grid gap-5 sm:grid-cols-2">
          {[
            ["Recognition time (Asia/Dhaka)", formatDate(row.recognized_at, true)],
            ["Employee", row.employee?.display_name ?? "Historical employee"],
            ["Vertical", row.vertical?.name ?? "Unassigned"],
            ["Type", row.contribution_type === "cash" ? "Cash" : "Valued in-kind"],
            ["Recorded by", row.recorder?.display_name ?? "System / historical recorder"],
            ["Recorded at", formatDate(row.created_at, true)],
          ].map(([key, value]) => (
            <div key={key}>
              <dt className="text-sm text-base-content/60">{key}</dt>
              <dd className="mt-1">{value}</dd>
            </div>
          ))}
        </dl>
        {row.approved_value_note && (
          <div>
            <h2 className="font-semibold">Agreed valuation / estimate source</h2>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm">{row.approved_value_note}</p>
          </div>
        )}
        {row.valuation_reference_url && (
          <a className="link break-all" href={row.valuation_reference_url} target="_blank" rel="noreferrer">
            Inventory / estimate reference
          </a>
        )}
        {original ? (
          <div>
            <h2 className="font-semibold">Reason for the correction</h2>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm">{row.correction_reason}</p>
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words text-sm">{row.notes || "No notes recorded."}</p>
        )}
        <p className="text-xs text-base-content/60">
          Append-only financial entry: it is never edited or deleted, and a PSE manager corrects a receipt with a
          separate reversal entry. Recognition time determines the reporting quarter in Asia/Dhaka; no currency
          conversion is applied.
        </p>
      </section>
      {!original && (
        <ContributionCorrections contribution={row} corrections={corrections} manager={isPseManager(access.profile)} />
      )}
    </>
  );
}

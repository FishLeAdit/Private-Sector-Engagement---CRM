import Link from "next/link";
import type { Contribution, ContributionCorrection } from "@/features/contributions/types";
import { remainingAmount } from "@/features/contributions/service";
import { formatDate } from "@/lib/dates";
import { decimal, money, signedCents } from "@/lib/money";
import { DataBlock, PanelHeader } from "@/components/ui/hud";
import { CorrectionForm } from "./correction-form";

// The corrections recorded against a receipt, its net amount, and (for managers) the form to add one.
export function ContributionCorrections({
  contribution,
  corrections,
  manager,
}: {
  contribution: Contribution;
  corrections: ContributionCorrection[];
  manager: boolean;
}) {
  const left = remainingAmount(contribution.amount, corrections),
    currency = contribution.currency;
  return (
    <section className="mt-6 max-w-3xl panel p-6" aria-labelledby="corrections-heading">
      <PanelHeader id="corrections-heading" title="Corrections" code={`RCV-COR // ${corrections.length}`} />
      <p className="text-sm text-muted">
        A PSE manager reverses part or all of a contribution with a separate correction entry, for a refund or a
        recording mistake. The original entry is never edited, and reports count the net amount in the same period.
      </p>
      {corrections.length ? (
        <>
          <div className="mt-4">
            <DataBlock
              items={[
                ["Recorded", money(contribution.amount, currency)],
                ["Corrected", money(decimal(left - signedCents(contribution.amount)), currency)],
                ["Net", money(decimal(left), currency)],
              ]}
            />
          </div>
          <ul className="mt-5 space-y-4">
            {corrections.map(c => (
              <li key={c.id}>
                <Link className="link font-semibold" href={`/contributions/${c.id}`}>
                  {money(c.amount, c.currency)}
                </Link>
                <p className="mt-1 text-sm text-muted">
                  {formatDate(c.created_at, true)} · {c.recorder?.display_name ?? "Historical recorder"}
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm">{c.correction_reason}</p>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-4 text-sm">No corrections recorded.</p>
      )}
      {manager &&
        (left > 0n ? (
          <CorrectionForm contributionId={contribution.id} currency={currency} remaining={decimal(left)} />
        ) : (
          <p className="mt-5 text-sm">This contribution has been fully reversed.</p>
        ))}
    </section>
  );
}

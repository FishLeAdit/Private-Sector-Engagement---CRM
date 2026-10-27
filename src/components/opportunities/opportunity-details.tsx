import Link from "next/link";
import type { OpportunityHistory, OpportunityRecord, Party, Stage } from "@/features/opportunities/types";
import { formatDate } from "@/lib/dates";
import { money } from "@/lib/money";
import { StageMove } from "./stage-move";

// Sections of the opportunity detail page.

// Expected value and deal terms. This is a forecast; the Won stage does not record received funds.
export function OpportunitySummary({
  row,
  editable,
  stages,
}: {
  row: OpportunityRecord;
  editable: boolean;
  stages: Stage[];
}) {
  return (
    <section className="space-y-5 rounded-xl border border-base-300 p-6">
      <h2 className="text-lg font-semibold">Financial opportunity</h2>
      <p className="text-2xl font-bold">
        {money(row.expected_amount, row.currency)} <span className="text-sm font-normal">expected</span>
      </p>
      <p className="text-sm text-base-content/65">
        Forecast value. Moving to Won does not recognize funds or change target achievement.
      </p>
      <dl className="grid gap-5 text-sm sm:grid-cols-2">
        {[
          ["Focal person", row.owner?.display_name],
          ["Contribution type", row.contribution_type === "cash" ? "Cash" : "Valued in-kind"],
          ["Category", row.category?.name],
          ["Expected closing", formatDate(row.expected_close_at)],
          ["Payment interval", row.payment_interval],
          ["Country", row.country],
          [
            "Operational budget (separate)",
            row.operational_budget == null ? "Not provided" : money(row.operational_budget, row.currency),
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-base-content/60">{label}</dt>
            <dd className="mt-1">{value || "Not provided"}</dd>
          </div>
        ))}
      </dl>
      {editable && <StageMove key={`${row.id}:${row.stage_id}`} id={row.id} stageId={row.stage_id} stages={stages} />}
    </section>
  );
}

function ContactInfo({ party, label }: { party: Party | null; label: string }) {
  return (
    <div>
      <dt className="text-base-content/60">{label}</dt>
      <dd className="mt-1">
        {party ? (
          <>
            <Link href={`/contacts/${party.id}`} className="link">
              {party.name}
            </Link>
            <p className="mt-1 break-all">{[party.email, party.phone].filter(Boolean).join(" · ")}</p>
            {party.website && (
              <a className="link mt-1 block break-all" href={party.website} target="_blank" rel="noreferrer">
                {party.website}
              </a>
            )}
          </>
        ) : (
          "Not linked"
        )}
      </dd>
    </div>
  );
}

// The party, plus primary and secondary contact people when the party is a company.
export function OpportunityContacts({ row }: { row: OpportunityRecord }) {
  return (
    <section className="rounded-xl border border-base-300 p-6">
      <h2 className="mb-5 text-lg font-semibold">Contact information</h2>
      <dl className="space-y-5 text-sm">
        <ContactInfo party={row.contact} label={row.contact?.kind === "company" ? "Company" : "Individual"} />
        {row.contact?.kind === "company" && (
          <>
            <ContactInfo party={row.primary_contact} label="Primary contact" />
            <ContactInfo party={row.secondary_contact} label="Secondary contact" />
          </>
        )}
      </dl>
    </section>
  );
}

export function OpportunityReferences({ row }: { row: OpportunityRecord }) {
  return (
    <section className="space-y-5 rounded-xl border border-base-300 p-6">
      <h2 className="text-lg font-semibold">Context and references</h2>
      {(
        [
          ["Description", row.description],
          ["Notes", row.notes],
          ["Agreed manual valuation", row.valuation_note],
        ] as const
      ).map(([label, value]) => (
        <div key={label}>
          <h3 className="mb-2 text-sm font-semibold">{label}</h3>
          <p className="whitespace-pre-wrap break-words text-sm leading-7">{value || "Not provided"}</p>
        </div>
      ))}
      {row.valuation_reference_url && (
        <a href={row.valuation_reference_url} target="_blank" rel="noreferrer" className="link block break-all text-sm">
          Valuation reference
        </a>
      )}
      <h3 className="text-sm font-semibold">Document references</h3>
      <ul className="space-y-2 text-sm">
        {row.drive_urls.map((url, index) => (
          <li key={`${index}:${url}`}>
            <a href={url} target="_blank" rel="noreferrer" className="link break-all">
              {url}
            </a>
          </li>
        ))}
      </ul>
      {!row.drive_urls.length && (
        <p className="text-sm text-base-content/60">No separate reference URLs. Links may also be recorded in Notes.</p>
      )}
    </section>
  );
}

// Actual receipts, kept apart from the expected value above.
export function OpportunityContributions({ contributions }: { contributions: OpportunityHistory["contributions"] }) {
  return (
    <section className="rounded-xl border border-base-300 p-6">
      <h2 className="text-lg font-semibold">Recognized contributions</h2>
      <p className="mt-2 text-sm text-base-content/65">
        Latest 10 recorded actuals, shown separately from expected value. Contribution entry is a later workflow.
      </p>
      <ul className="mt-5 space-y-4">
        {contributions.map(item => (
          <li key={item.id}>
            <p className="font-semibold">{money(item.amount, item.currency)}</p>
            <p className="mt-1 text-sm text-base-content/65">
              {formatDate(item.recognized_at)} · {item.contribution_type === "cash" ? "Cash" : "Valued in-kind"}
            </p>
            {item.notes && <p className="mt-1 whitespace-pre-wrap text-sm">{item.notes}</p>}
          </li>
        ))}
      </ul>
      {!contributions.length && <p className="mt-5 text-sm">No recognized contributions recorded.</p>}
    </section>
  );
}

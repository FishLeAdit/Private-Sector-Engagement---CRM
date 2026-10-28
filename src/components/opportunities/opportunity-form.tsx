"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  emptyOpportunity,
  opportunitySchema,
  type OpportunityFormInput,
  type OpportunityInput,
} from "@/features/opportunities/schemas";
import type { OpportunityOptions, Party } from "@/features/opportunities/types";
import { sendJson } from "@/lib/send-json";
import { applyFieldErrors, DocumentUrlsField, FieldError, FormActions, OwnerField } from "@/components/ui/form";
import { DealContactField, useDealContacts } from "./deal-contacts";
import { InlineContactDialog, type ContactField } from "./inline-contact-dialog";

type TextField =
  | "deal_name"
  | "currency"
  | "payment_interval"
  | "country"
  | "expected_close_at"
  | "expected_amount"
  | "operational_budget"
  | "valuation_reference_url";

export function OpportunityForm({
  initial,
  opportunityId,
  options,
  manager,
  userId,
  contacts = {},
}: {
  initial?: OpportunityInput;
  opportunityId?: string;
  options: OpportunityOptions;
  manager: boolean;
  userId: string;
  contacts?: Partial<Record<ContactField, Party | null>>;
}) {
  const router = useRouter();
  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<OpportunityFormInput, unknown, OpportunityInput>({
    resolver: zodResolver(opportunitySchema),
    defaultValues: initial ?? { ...emptyOpportunity, owner_id: userId },
    mode: "onBlur",
  });
  const contributionType = useWatch({ control, name: "contribution_type" });
  const dealContacts = useDealContacts(contacts, setValue);
  // Primary and secondary contact people only apply to company deals.
  const company = dealContacts.company;
  const [error, setSaveError] = useState("");

  async function save(data: OpportunityInput) {
    setSaveError("");
    try {
      const { ok, result } = await sendJson(
        opportunityId ? `/api/opportunities/${opportunityId}` : "/api/opportunities",
        opportunityId ? "PATCH" : "POST",
        data,
      );
      if (!ok) {
        applyFieldErrors(result.fields, emptyOpportunity, setError);
        setSaveError(result.error || "Opportunity could not be saved.");
        return;
      }
      router.push(`/opportunities/${result.opportunity.id}?saved=${opportunityId ? "updated" : "created"}`);
      router.refresh();
    } catch {
      setSaveError("Opportunity could not be saved. Check your connection and try again.");
    }
  }
  const issue = (field: keyof OpportunityInput) => (
    <FieldError error={errors[field]} fallback="Use up to 20 valid HTTP(S) reference URLs." />
  );
  const input = (field: keyof OpportunityInput) => ({ ...register(field), "aria-invalid": !!errors[field] });

  const textField = (field: TextField, label: string, type = "text", maxLength = 200) => (
    <div>
      <label htmlFor={`deal-${field}`} className="mb-2 block text-sm font-medium">
        {label}
      </label>
      <input
        id={`deal-${field}`}
        type={type}
        maxLength={maxLength}
        inputMode={field.includes("amount") || field === "operational_budget" ? "decimal" : undefined}
        className="input input-bordered w-full"
        {...input(field)}
      />
      {issue(field)}
    </div>
  );
  // Stage/category lists: inactive entries stay visible only when this deal already uses them.
  const lookup = (
    field: "stage_id" | "contribution_category_id",
    label: string,
    rows: OpportunityOptions["stages"] | OpportunityOptions["categories"],
  ) => (
    <div>
      <label htmlFor={`deal-${field}`} className="mb-2 block text-sm font-medium">
        {label}
      </label>
      <select id={`deal-${field}`} className="select select-bordered w-full" {...input(field)}>
        <option value="">Choose…</option>
        {rows
          .filter(row => row.active || row.id === initial?.[field])
          .map(row => (
            <option key={row.id} value={row.id}>
              {row.name}
              {!row.active ? " (inactive)" : row.is_provisional ? " (provisional)" : ""}
            </option>
          ))}
      </select>
      {issue(field)}
    </div>
  );
  const contactField = (field: ContactField) => (
    <DealContactField
      field={field}
      contacts={dealContacts}
      control={control}
      disabled={isSubmitting}
      error={issue(field)}
    />
  );

  return (
    <>
      <form onSubmit={handleSubmit(save)} className="max-w-4xl space-y-7" noValidate>
        <p className="border-l-2 border-info bg-info/5 p-4 text-sm">
          Enter an expected financial opportunity. Unvalued gifts, visits and general engagement belong in Activities.
          Expected value and operational budget are separate from received contributions.
        </p>
        <fieldset disabled={isSubmitting} className="space-y-6">
          <legend className="sr-only">Opportunity details</legend>
          <div className="grid gap-5 sm:grid-cols-2">
            {textField("deal_name", "Deal name *")}
            <OwnerField
              id="deal-owner"
              label="Focal person (employee) *"
              manager={manager}
              owners={options.owners}
              ownerId={initial?.owner_id ?? userId}
              placeholderName="Current focal person"
              selectProps={input("owner_id")}
              hiddenProps={register("owner_id")}
              error={issue("owner_id")}
            />
            <div>
              <label htmlFor="deal-type" className="mb-2 block text-sm font-medium">
                Contribution type *
              </label>
              <select id="deal-type" className="select select-bordered w-full" {...input("contribution_type")}>
                <option value="cash">Cash</option>
                <option value="valued_in_kind">Valued in-kind</option>
              </select>
              {issue("contribution_type")}
            </div>
            {lookup("contribution_category_id", "Contribution category *", options.categories)}
            {contactField("contact_id")}
            {lookup("stage_id", "Stage *", options.stages)}
          </div>
          {company && (
            <section className="space-y-4 panel p-4">
              <h2 className="font-semibold">Company contact people</h2>
              <div className="grid gap-5 sm:grid-cols-2">
                {contactField("primary_contact_id")}
                {contactField("secondary_contact_id")}
              </div>
            </section>
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            {textField("expected_amount", company ? "Expected fund *" : "Budgeted fund (expected value) *", "text", 15)}
            {textField("currency", "Currency (three-letter code) *", "text", 3)}
            {textField("payment_interval", "Payment interval (optional)")}
            {textField("expected_close_at", "Expected closing date (optional)", "date")}
            {textField("country", "Country (optional)")}
            {textField("operational_budget", "Operational budget (optional)", "text", 15)}
          </div>
          {contributionType === "valued_in_kind" && (
            <section className="space-y-4 panel p-4">
              <h2 className="font-semibold">Manual valuation</h2>
              <p className="text-sm text-base-content/65">
                PSE enters the value agreed from the operational team’s inventory and market estimate. This form does
                not calculate market value or recognize achievement.
              </p>
              <div>
                <label htmlFor="deal-valuation" className="mb-2 block text-sm font-medium">
                  Agreed valuation and source *
                </label>
                <textarea
                  id="deal-valuation"
                  className="textarea textarea-bordered min-h-28 w-full"
                  maxLength={10000}
                  {...input("valuation_note")}
                />
                {issue("valuation_note")}
              </div>
              {textField("valuation_reference_url", "Valuation reference URL (optional)", "url", 2048)}
            </section>
          )}
          {(["description", "notes"] as const).map(field => (
            <div key={field}>
              <label htmlFor={`deal-${field}`} className="mb-2 block text-sm font-medium">
                {field === "notes" ? "Notes" : "Description"} (optional)
              </label>
              <textarea
                id={`deal-${field}`}
                className="textarea textarea-bordered min-h-32 w-full"
                maxLength={10000}
                placeholder="Context and Google Drive links"
                {...input(field)}
              />
              {issue(field)}
            </div>
          ))}
          <DocumentUrlsField
            control={control}
            name="drive_urls"
            id="deal-links"
            label="Document reference URLs (optional, one per line)"
            className="textarea textarea-bordered min-h-28 w-full"
            hint="Paste Google Drive links here or in Notes. Up to 20 HTTP(S) links; direct uploads are excluded."
            error={issue("drive_urls")}
          />
        </fieldset>
        <FormActions
          error={error}
          busy={isSubmitting}
          disabled={isSubmitting}
          submitLabel={opportunityId ? "Save changes" : "Create deal"}
          cancelHref={opportunityId ? `/opportunities/${opportunityId}` : "/opportunities"}
        />
      </form>
      <InlineContactDialog request={dealContacts.creation} company={company} onSaved={dealContacts.select} />
    </>
  );
}

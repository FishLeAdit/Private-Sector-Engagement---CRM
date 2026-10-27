"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  emptyOpportunity,
  opportunitySchema,
  type OpportunityFormInput,
  type OpportunityInput,
} from "@/features/opportunities/schemas";
import type { OpportunityOptions, Party } from "@/features/opportunities/types";
import { emptyContact } from "@/features/contacts/schemas";
import { ContactForm } from "@/components/contacts/contact-form";
import { ContactPicker } from "./contact-picker";

type ContactField = "contact_id" | "primary_contact_id" | "secondary_contact_id";
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
  const [selected, setSelected] = useState<Partial<Record<ContactField, Party | null>>>(contacts);
  const [error, setSaveError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const [creation, setCreation] = useState<{ field: ContactField; key: number }>({ field: "contact_id", key: 0 });
  // Open after the fresh contact form mounts, so native dialog focus targets it.
  useEffect(() => {
    if (creation.key) dialog.current?.showModal();
  }, [creation.key]);
  const company = selected.contact_id?.kind === "company" ? selected.contact_id : null;
  const labels: Record<ContactField, string> = {
    contact_id: "Individual / company",
    primary_contact_id: "Primary contact",
    secondary_contact_id: "Secondary contact (optional)",
  };
  function select(field: ContactField, party: Party | null) {
    setSelected(current => ({
      ...current,
      [field]: party,
      ...(field === "contact_id" ? { primary_contact_id: null, secondary_contact_id: null } : {}),
    }));
    setValue(field, party?.id ?? "", { shouldValidate: true, shouldDirty: true });
    if (field === "contact_id") {
      setValue("primary_contact_id", "");
      setValue("secondary_contact_id", "");
    }
  }
  function createContact(field: ContactField) {
    setCreation(current => ({ field, key: current.key + 1 }));
  }
  async function save(data: OpportunityInput) {
    setSaveError("");
    try {
      const response = await fetch(opportunityId ? `/api/opportunities/${opportunityId}` : "/api/opportunities", {
        method: opportunityId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) {
        for (const [field, messages] of Object.entries(result.fields ?? {}) as [keyof OpportunityInput, string[]][])
          if (field in emptyOpportunity) setError(field, { type: "server", message: messages[0] });
        setSaveError(result.error || "Opportunity could not be saved.");
        return;
      }
      router.push(`/opportunities/${result.opportunity.id}?saved=${opportunityId ? "updated" : "created"}`);
      router.refresh();
    } catch {
      setSaveError("Opportunity could not be saved. Check your connection and try again.");
    }
  }
  const issue = (field: keyof OpportunityInput) =>
    errors[field] ? (
      <p className="mt-1 text-sm text-error" role="alert">
        {errors[field]?.message || "Use up to 20 valid HTTP(S) reference URLs."}
      </p>
    ) : null;
  const input = (field: keyof OpportunityInput) => ({ ...register(field), "aria-invalid": !!errors[field] });
  const textField = (
    field:
      | "deal_name"
      | "currency"
      | "payment_interval"
      | "country"
      | "expected_close_at"
      | "expected_amount"
      | "operational_budget"
      | "valuation_reference_url",
    label: string,
    type = "text",
    maxLength = 200,
  ) => (
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
    <div>
      <Controller
        name={field}
        control={control}
        render={({ field: value }) => (
          <ContactPicker
            value={value.value ?? ""}
            selected={selected[field] ?? null}
            onSelect={party => select(field, party)}
            label={labels[field]}
            individual={field !== "contact_id"}
            disabled={isSubmitting}
          />
        )}
      />
      {issue(field)}
      <button type="button" className="btn btn-link btn-sm mt-1 px-0" onClick={() => createContact(field)}>
        Create{" "}
        {field === "contact_id" ? "contact" : field === "primary_contact_id" ? "primary contact" : "secondary contact"}
      </button>
    </div>
  );
  return (
    <>
      <form onSubmit={handleSubmit(save)} className="max-w-4xl space-y-7" noValidate>
        <p className="rounded-lg bg-info/10 p-4 text-sm">
          Enter an expected financial opportunity. Unvalued gifts, visits and general engagement belong in Activities.
          Expected value and operational budget are separate from received contributions.
        </p>
        <fieldset disabled={isSubmitting} className="space-y-6">
          <legend className="sr-only">Opportunity details</legend>
          <div className="grid gap-5 sm:grid-cols-2">
            {textField("deal_name", "Deal name *")}
            <div>
              <label htmlFor="deal-owner" className="mb-2 block text-sm font-medium">
                Focal person (employee) *
              </label>
              {manager ? (
                <select id="deal-owner" className="select select-bordered w-full" {...input("owner_id")}>
                  <option value="">Choose…</option>
                  {options.owners
                    .filter(row => row.active || row.id === initial?.owner_id)
                    .map(row => (
                      <option key={row.id} value={row.id}>
                        {row.display_name}
                        {!row.active && " (inactive)"}
                      </option>
                    ))}
                </select>
              ) : (
                <>
                  <input type="hidden" {...register("owner_id")} />
                  <input
                    id="deal-owner"
                    readOnly
                    className="input input-bordered w-full bg-base-200"
                    value={
                      options.owners.find(row => row.id === (initial?.owner_id ?? userId))?.display_name ??
                      "Current focal person"
                    }
                  />
                </>
              )}
              {issue("owner_id")}
            </div>
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
            <section className="space-y-4 rounded-lg border border-base-300 p-4">
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
            <section className="space-y-4 rounded-lg border border-base-300 p-4">
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
          <div>
            <label htmlFor="deal-links" className="mb-2 block text-sm font-medium">
              Document reference URLs (optional, one per line)
            </label>
            <Controller
              name="drive_urls"
              control={control}
              render={({ field }) => (
                <textarea
                  id="deal-links"
                  className="textarea textarea-bordered min-h-28 w-full"
                  value={field.value?.join("\n") ?? ""}
                  onChange={event => field.onChange(event.target.value.split("\n"))}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  placeholder="https://drive.google.com/…"
                />
              )}
            />
            {issue("drive_urls")}
            <p className="mt-1 text-xs text-base-content/60">
              Paste Google Drive links here or in Notes. Up to 20 HTTP(S) links; direct uploads are excluded.
            </p>
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="rounded-lg bg-error/10 p-4 text-error">
            {error}
          </p>
        )}
        <div className="flex gap-3 border-t border-base-300 pt-5">
          <button className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : opportunityId ? "Save changes" : "Create deal"}
          </button>
          <Link className="btn btn-ghost" href={opportunityId ? `/opportunities/${opportunityId}` : "/opportunities"}>
            Cancel
          </Link>
        </div>
      </form>
      <dialog ref={dialog} className="modal" aria-labelledby="inline-contact-title">
        <div className="modal-box max-w-3xl">
          <h2 id="inline-contact-title" className="mb-3 text-xl font-bold">
            Create a contact for this deal
          </h2>
          <p className="mb-5 text-sm text-base-content/65">
            Saving creates a contact immediately, even if you later cancel the deal. Your deal draft stays open.
          </p>
          <ContactForm
            key={creation.key}
            fixedKind={creation.field === "contact_id" ? undefined : "individual"}
            company={creation.field !== "contact_id" && company ? company : null}
            initial={{ ...emptyContact, company_id: creation.field !== "contact_id" ? (company?.id ?? "") : "" }}
            onSaved={contact => {
              select(creation.field, contact);
              dialog.current?.close();
            }}
            onCancel={() => dialog.current?.close()}
          />
        </div>
      </dialog>
    </>
  );
}

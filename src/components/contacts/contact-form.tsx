"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { contactSchema, emptyContact, type ContactFormInput, type ContactInput } from "@/features/contacts/schemas";
import type { CompanyOption, ContactApiError, ContactRecord } from "@/features/contacts/types";
import { sendJson } from "@/lib/send-json";
import { applyFieldErrors, FieldError, FormActions } from "@/components/ui/form";
import { CompanyPicker } from "./company-picker";
import { DuplicateWarning, useDuplicateCheck } from "./duplicate-check";

const optional = <span className="font-normal text-base-content/60">(optional)</span>;

// Used on the contact pages and inside the New Deal dialog (with onSaved/onCancel and, optionally, a fixed kind).
export function ContactForm({
  initial = emptyContact,
  contactId,
  company,
  fixedKind,
  onSaved,
  onCancel,
}: {
  initial?: ContactInput;
  contactId?: string;
  company?: CompanyOption | null;
  fixedKind?: "individual" | "company";
  onSaved?: (contact: ContactRecord) => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormInput, unknown, ContactInput>({
    resolver: zodResolver(contactSchema),
    defaultValues: { ...initial, kind: fixedKind ?? initial.kind },
    mode: "onBlur",
  });
  const kind = useWatch({ control, name: "kind" });
  const email = useWatch({ control, name: "email" }) ?? "";
  const phone = useWatch({ control, name: "phone" }) ?? "";
  const duplicates = useDuplicateCheck(email, phone, contactId);
  const [saveError, setSaveError] = useState("");

  // Companies cannot belong to another company.
  useEffect(() => {
    if (kind === "company") setValue("company_id", "");
  }, [kind, setValue]);

  async function save(data: ContactInput) {
    setSaveError("");
    try {
      const { ok, result } = await sendJson(
        contactId ? `/api/contacts/${contactId}` : "/api/contacts",
        contactId ? "PATCH" : "POST",
        data,
      );
      if (!ok) {
        const problem = result as ContactApiError;
        applyFieldErrors(problem.fields, emptyContact, setError);
        if (problem.duplicates?.length) duplicates.showMatches(problem.duplicates);
        setSaveError(problem.error || "Contact could not be saved. Please try again.");
        return;
      }
      if (onSaved) {
        onSaved(result.contact);
        return;
      }
      router.push(`/contacts/${result.contact.id}?saved=${contactId ? "updated" : "created"}`);
      router.refresh();
    } catch {
      setSaveError("Contact could not be saved. Check your connection and try again.");
    }
  }

  const fieldError = (field: keyof ContactInput) => <FieldError id={`${field}-error`} error={errors[field]} />;
  const field = (name: keyof ContactInput) => ({
    ...register(name),
    "aria-invalid": !!errors[name],
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });

  return (
    <form onSubmit={handleSubmit(save)} className="max-w-3xl space-y-7" noValidate>
      <fieldset disabled={isSubmitting} className="space-y-6">
        <legend className="sr-only">Contact details</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="kind" className="mb-2 block text-sm font-medium">
              Contact type
            </label>
            {contactId || fixedKind ? (
              // The type of an existing contact cannot change.
              <>
                <input type="hidden" {...register("kind")} />
                <p className="border border-base-300 bg-base-200/60 px-4 py-3 capitalize">
                  {fixedKind ?? initial.kind}
                </p>
              </>
            ) : (
              <select id="kind" className="select select-bordered w-full" {...register("kind")}>
                <option value="individual">Individual</option>
                <option value="company">Company</option>
              </select>
            )}
            {fieldError("kind")}
          </div>
          <div>
            <label htmlFor="name" className="mb-2 block text-sm font-medium">
              {kind === "company" ? "Company name" : "Contact name"} <span aria-hidden="true">*</span>
            </label>
            <input
              id="name"
              className="input input-bordered w-full"
              autoComplete={kind === "company" ? "organization" : "name"}
              maxLength={200}
              {...field("name")}
            />
            {fieldError("name")}
          </div>
        </div>
        <div>
          <p className="mb-3 text-sm text-base-content/70">
            Provide at least one communication method: email or phone.
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="contact-email" className="mb-2 block text-sm font-medium">
                Email address
              </label>
              <input
                id="contact-email"
                className="input input-bordered w-full"
                type="email"
                autoComplete="email"
                maxLength={254}
                {...field("email")}
              />
              {fieldError("email")}
            </div>
            <div>
              <label htmlFor="contact-phone" className="mb-2 block text-sm font-medium">
                Phone number
              </label>
              <input
                id="contact-phone"
                className="input input-bordered w-full"
                type="tel"
                autoComplete="tel"
                placeholder="Include country code"
                maxLength={64}
                {...field("phone")}
              />
              {fieldError("phone")}
            </div>
          </div>
        </div>
        <DuplicateWarning matches={duplicates.matches} checkError={duplicates.checkError} />
        {kind === "individual" && (
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Controller
                name="company_id"
                control={control}
                render={({ field: company_id }) => (
                  <CompanyPicker
                    value={company_id.value ?? ""}
                    onChange={company_id.onChange}
                    initial={company}
                    disabled={isSubmitting}
                  />
                )}
              />
              {fieldError("company_id")}
            </div>
            <div>
              <label htmlFor="designation" className="mb-2 block text-sm font-medium">
                Designation {optional}
              </label>
              <input
                id="designation"
                className="input input-bordered w-full"
                maxLength={200}
                autoComplete="organization-title"
                {...field("designation")}
              />
              {fieldError("designation")}
            </div>
          </div>
        )}
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="website" className="mb-2 block text-sm font-medium">
              Website {optional}
            </label>
            <input
              id="website"
              className="input input-bordered w-full"
              type="url"
              autoComplete="url"
              placeholder="https://"
              maxLength={2048}
              {...field("website")}
            />
            {fieldError("website")}
          </div>
          <div>
            <label htmlFor="industry" className="mb-2 block text-sm font-medium">
              Industry {optional}
            </label>
            <input id="industry" className="input input-bordered w-full" maxLength={200} {...field("industry")} />
            {fieldError("industry")}
          </div>
        </div>
        <div>
          <label htmlFor="notes" className="mb-2 block text-sm font-medium">
            Relationship notes {optional}
          </label>
          <textarea
            id="notes"
            className="textarea textarea-bordered min-h-36 w-full"
            maxLength={10000}
            placeholder="Referrals, roles, donor background, engagement history or Google Drive links"
            {...field("notes")}
          />
          {fieldError("notes")}
        </div>
      </fieldset>
      <FormActions
        error={saveError}
        busy={isSubmitting}
        disabled={isSubmitting}
        submitLabel={contactId ? "Save changes" : "Create contact"}
        cancelHref={contactId ? `/contacts/${contactId}` : "/contacts"}
        onCancel={onCancel}
      />
    </form>
  );
}

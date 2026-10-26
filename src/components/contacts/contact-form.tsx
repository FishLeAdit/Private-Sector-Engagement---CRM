"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { contactSchema, duplicateCheckSchema, emptyContact, normalizeEmail, normalizePhone, type ContactFormInput, type ContactInput } from "@/features/contacts/schemas";
import type { CompanyOption, ContactApiError, ContactRecord, DuplicateContact } from "@/features/contacts/types";
import { CompanyPicker } from "./company-picker";

export function ContactForm({ initial = emptyContact, contactId, company, fixedKind, onSaved, onCancel }: {
  initial?: ContactInput; contactId?: string; company?: CompanyOption | null; fixedKind?: "individual" | "company";
  onSaved?: (contact: ContactRecord) => void; onCancel?: () => void;
}) {
  const router = useRouter();
  const { register, control, handleSubmit, setValue, setError, formState: { errors, isSubmitting } } = useForm<ContactFormInput, unknown, ContactInput>({
    resolver: zodResolver(contactSchema), defaultValues: { ...initial, kind: fixedKind ?? initial.kind }, mode: "onBlur",
  });
  const kind = useWatch({ control, name: "kind" });
  const email = useWatch({ control, name: "email" }) ?? "";
  const phone = useWatch({ control, name: "phone" }) ?? "";
  const key = `${normalizeEmail(email) ?? ""}|${normalizePhone(phone) ?? ""}`;
  const [duplicateResult, setDuplicateResult] = useState<{ key: string; matches: DuplicateContact[]; error: string }>({ key: "", matches: [], error: "" });
  const [saveError, setSaveError] = useState("");
  const matches = duplicateResult.key === key ? duplicateResult.matches : [];

  useEffect(() => { if (kind === "company") setValue("company_id", ""); }, [kind, setValue]);
  useEffect(() => {
    const input = duplicateCheckSchema.safeParse({ email, phone, exclude: contactId });
    if (!input.success || key === "|") return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/contacts/duplicates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input.data), signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("Check unavailable");
        const data = await response.json();
        if (!controller.signal.aborted) setDuplicateResult({ key, matches: data.duplicates, error: "" });
      } catch {
        if (!controller.signal.aborted) setDuplicateResult({ key, matches: [], error: "Could not check for existing contacts. You can still try saving." });
      }
    }, 400);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [email, phone, key, contactId]);

  async function save(data: ContactInput) {
    setSaveError("");
    try {
      const response = await fetch(contactId ? `/api/contacts/${contactId}` : "/api/contacts", {
        method: contactId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) {
        const problem = result as ContactApiError;
        for (const [field, messages] of Object.entries(problem.fields ?? {})) {
          if (field in emptyContact) setError(field as keyof ContactInput, { type: "server", message: messages[0] });
        }
        if (problem.duplicates?.length) setDuplicateResult({ key, matches: problem.duplicates, error: "" });
        setSaveError(problem.error || "Contact could not be saved. Please try again.");
        return;
      }
      if (onSaved) { onSaved(result.contact); return; }
      router.push(`/contacts/${result.contact.id}?saved=${contactId ? "updated" : "created"}`);
      router.refresh();
    } catch { setSaveError("Contact could not be saved. Check your connection and try again."); }
  }

  const fieldError = (field: keyof ContactInput) => errors[field] ? <p id={`${field}-error`} className="mt-1 text-sm text-error" role="alert">{errors[field]?.message}</p> : null;
  const inputProps = (field: keyof ContactInput) => ({ "aria-invalid": !!errors[field], "aria-describedby": errors[field] ? `${field}-error` : undefined });

  return <form onSubmit={handleSubmit(save)} className="max-w-3xl space-y-7" noValidate>
    <fieldset disabled={isSubmitting} className="space-y-6">
      <legend className="sr-only">Contact details</legend>
      <div className="grid gap-5 sm:grid-cols-2">
        <div><label htmlFor="kind" className="mb-2 block text-sm font-medium">Contact type</label>
          {contactId || fixedKind ? <><input type="hidden" {...register("kind")} /><p className="rounded-lg bg-base-200 px-4 py-3 capitalize">{fixedKind ?? initial.kind}</p></>
            : <select id="kind" className="select select-bordered w-full" {...register("kind")}><option value="individual">Individual</option><option value="company">Company</option></select>}
          {fieldError("kind")}
        </div>
        <div><label htmlFor="name" className="mb-2 block text-sm font-medium">{kind === "company" ? "Company name" : "Contact name"} <span aria-hidden="true">*</span></label>
          <input id="name" className="input input-bordered w-full" autoComplete={kind === "company" ? "organization" : "name"} maxLength={200} {...register("name")} {...inputProps("name")} />{fieldError("name")}</div>
      </div>
      <div>
        <p className="mb-3 text-sm text-base-content/70">Provide at least one communication method: email or phone.</p>
        <div className="grid gap-5 sm:grid-cols-2">
          <div><label htmlFor="contact-email" className="mb-2 block text-sm font-medium">Email address</label><input id="contact-email" className="input input-bordered w-full" type="email" autoComplete="email" maxLength={254} {...register("email")} {...inputProps("email")} />{fieldError("email")}</div>
          <div><label htmlFor="contact-phone" className="mb-2 block text-sm font-medium">Phone number</label><input id="contact-phone" className="input input-bordered w-full" type="tel" autoComplete="tel" placeholder="Include country code" maxLength={64} {...register("phone")} {...inputProps("phone")} />{fieldError("phone")}</div>
        </div>
      </div>
      {matches.length > 0 && <div role="alert" className="rounded-lg border border-warning bg-warning/10 p-4 text-sm"><p className="font-semibold">Possible duplicate contact</p>
        <ul className="mt-2 space-y-1">{matches.map(match => <li key={match.id}><Link href={`/contacts/${match.id}`} target="_blank" rel="noreferrer" className="link">{match.name}</Link> — matching {match.fields.join(" and ")}</li>)}</ul>
        <p className="mt-2">Review the existing contact or use different contact details.</p>
      </div>}
      {duplicateResult.key === key && duplicateResult.error && <p role="status" className="text-sm text-base-content/70">{duplicateResult.error}</p>}
      {kind === "individual" && <div className="grid gap-5 sm:grid-cols-2">
        <div><Controller name="company_id" control={control} render={({ field }) => <CompanyPicker value={field.value ?? ""} onChange={field.onChange} initial={company} disabled={isSubmitting} />} />{fieldError("company_id")}</div>
        <div><label htmlFor="designation" className="mb-2 block text-sm font-medium">Designation <span className="font-normal text-base-content/60">(optional)</span></label><input id="designation" className="input input-bordered w-full" maxLength={200} autoComplete="organization-title" {...register("designation")} {...inputProps("designation")} />{fieldError("designation")}</div>
      </div>}
      <div className="grid gap-5 sm:grid-cols-2">
        <div><label htmlFor="website" className="mb-2 block text-sm font-medium">Website <span className="font-normal text-base-content/60">(optional)</span></label><input id="website" className="input input-bordered w-full" type="url" autoComplete="url" placeholder="https://" maxLength={2048} {...register("website")} {...inputProps("website")} />{fieldError("website")}</div>
        <div><label htmlFor="industry" className="mb-2 block text-sm font-medium">Industry <span className="font-normal text-base-content/60">(optional)</span></label><input id="industry" className="input input-bordered w-full" maxLength={200} {...register("industry")} {...inputProps("industry")} />{fieldError("industry")}</div>
      </div>
      <div><label htmlFor="notes" className="mb-2 block text-sm font-medium">Relationship notes <span className="font-normal text-base-content/60">(optional)</span></label>
        <textarea id="notes" className="textarea textarea-bordered min-h-36 w-full" maxLength={10000} placeholder="Referrals, roles, donor background, engagement history or Google Drive links" {...register("notes")} {...inputProps("notes")} />{fieldError("notes")}</div>
    </fieldset>
    {saveError && <p className="rounded-lg bg-error/10 p-4 text-sm text-error" role="alert">{saveError}</p>}
    <div className="flex items-center gap-3 border-t border-base-300 pt-5">
      <button className="btn btn-primary" type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving…" : contactId ? "Save changes" : "Create contact"}</button>
      {onCancel ? <button type="button" className="btn btn-ghost" disabled={isSubmitting} onClick={onCancel}>Cancel</button> : <Link href={contactId ? `/contacts/${contactId}` : "/contacts"} className="btn btn-ghost">Cancel</Link>}
    </div>
  </form>;
}

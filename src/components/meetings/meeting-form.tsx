"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { emptyMeeting, meetingSchema, type MeetingFormInput, type MeetingInput } from "@/features/meetings/schemas";
import type { MeetingContact, MeetingOpportunity, MeetingOptions } from "@/features/meetings/types";
import { fromDhakaDateTimeInput, toDhakaDateTimeInput } from "@/lib/dates";
import { ContactPicker } from "@/components/opportunities/contact-picker";
import { OpportunityPicker } from "./opportunity-picker";
import { MeetingContactInformation } from "./contact-information";

export function MeetingForm({
  initial,
  meetingId,
  options,
  userId,
  manager,
}: {
  initial?: MeetingInput;
  meetingId?: string;
  options: MeetingOptions;
  userId: string;
  manager: boolean;
}) {
  const router = useRouter();
  const defaults = initial ?? {
    ...emptyMeeting,
    owner_id: userId,
    contact_id: options.contact?.id ?? "",
    opportunity_id: options.opportunity?.id ?? "",
  };
  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<MeetingFormInput, unknown, MeetingInput>({
    resolver: zodResolver(meetingSchema),
    defaultValues: defaults,
    mode: "onBlur",
  });
  const [contact, setContact] = useState<MeetingContact | null>(options.contact),
    [opportunity, setOpportunity] = useState<MeetingOpportunity | null>(options.opportunity);
  const [time, setTime] = useState(toDhakaDateTimeInput(defaults.scheduled_at)),
    [error, setSaveError] = useState(""),
    [notice, setNotice] = useState("");
  const [selectingOpportunity, setSelectingOpportunity] = useState(false);
  const choices = opportunity
    ? [opportunity.contact, opportunity.primary_contact, opportunity.secondary_contact]
        .filter((row): row is MeetingContact => !!row)
        .filter((row, index, rows) => rows.findIndex(other => other.id === row.id) === index)
    : [];
  function chooseContact(row: MeetingContact | null) {
    setContact(row);
    setValue("contact_id", row?.id ?? "", { shouldValidate: true, shouldDirty: true });
  }
  function chooseOpportunity(row: MeetingOpportunity | null) {
    setOpportunity(row);
    setValue("opportunity_id", row?.id ?? "", { shouldValidate: true, shouldDirty: true });
    setNotice("");
    if (row && contact && ![row.contact_id, row.primary_contact_id, row.secondary_contact_id].includes(contact.id)) {
      chooseContact(null);
      setNotice(
        "The previous contact was cleared because it is not linked to this opportunity. You can use the opportunity’s contact details or choose one of its contact people.",
      );
    }
  }
  async function save(data: MeetingInput) {
    if (selectingOpportunity) return;
    setSaveError("");
    try {
      const response = await fetch(meetingId ? `/api/meetings/${meetingId}` : "/api/meetings", {
        method: meetingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) {
        for (const [field, messages] of Object.entries(result.fields ?? {}) as [keyof MeetingInput, string[]][])
          if (field in emptyMeeting) setError(field, { type: "server", message: messages[0] });
        setSaveError(result.error || "Meeting could not be saved.");
        return;
      }
      router.push(`/meetings/${result.meeting.id}?saved=${meetingId ? "updated" : "created"}`);
      router.refresh();
    } catch {
      setSaveError("Meeting could not be saved. Check your connection and try again.");
    }
  }
  const issue = (field: keyof MeetingInput) =>
    errors[field] ? (
      <p id={`meeting-${field}-error`} role="alert" className="mt-1 text-sm text-error">
        {errors[field]?.message}
      </p>
    ) : null;
  const input = (field: keyof MeetingInput) => ({
    ...register(field),
    "aria-invalid": !!errors[field],
    "aria-describedby": errors[field] ? `meeting-${field}-error` : undefined,
  });
  return (
    <form onSubmit={handleSubmit(save)} className="max-w-4xl space-y-7" noValidate>
      <p className="rounded-lg bg-info/10 p-4 text-sm">
        Link a contact, an opportunity, or both. Contact details come from your internal records. Meeting times are
        entered and displayed in Asia/Dhaka.
      </p>
      <fieldset disabled={isSubmitting || selectingOpportunity} className="space-y-6">
        <legend className="sr-only">Meeting details</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="meeting-title" className="mb-2 block text-sm font-medium">
              Meeting title *
            </label>
            <input id="meeting-title" className="input input-bordered w-full" maxLength={200} {...input("title")} />
            {issue("title")}
          </div>
          <div>
            <label htmlFor="meeting-owner" className="mb-2 block text-sm font-medium">
              Owner *
            </label>
            {manager ? (
              <select id="meeting-owner" className="select select-bordered w-full" {...input("owner_id")}>
                <option value="">Choose…</option>
                {options.owners
                  .filter(row => row.active || row.id === defaults.owner_id)
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
                  id="meeting-owner"
                  readOnly
                  className="input input-bordered w-full bg-base-200"
                  value={options.owners.find(row => row.id === defaults.owner_id)?.display_name ?? "Current owner"}
                />
              </>
            )}
            {issue("owner_id")}
          </div>
          <div>
            <OpportunityPicker
              selected={opportunity}
              onSelect={chooseOpportunity}
              disabled={isSubmitting}
              onBusyChange={setSelectingOpportunity}
            />
            {issue("opportunity_id")}
          </div>
          <div>
            {opportunity ? (
              <Controller
                name="contact_id"
                control={control}
                render={({ field }) => (
                  <>
                    <label htmlFor="meeting-contact" className="mb-2 block text-sm font-medium">
                      Contact person / organization
                    </label>
                    <select
                      id="meeting-contact"
                      className="select select-bordered w-full"
                      value={field.value ?? ""}
                      onChange={event => chooseContact(choices.find(row => row.id === event.target.value) ?? null)}
                      onBlur={field.onBlur}
                      ref={field.ref}
                    >
                      <option value="">Use opportunity contact details</option>
                      {choices.map(row => (
                        <option key={row.id} value={row.id}>
                          {row.name} ({row.kind})
                        </option>
                      ))}
                    </select>
                    <p className="mt-2 text-xs text-base-content/60">
                      An explicit contact must be the opportunity’s party, primary or secondary contact.
                    </p>
                  </>
                )}
              />
            ) : (
              <Controller
                name="contact_id"
                control={control}
                render={({ field }) => (
                  <ContactPicker<MeetingContact>
                    value={field.value ?? ""}
                    selected={contact}
                    onSelect={chooseContact}
                    label="Contact person / organization"
                    disabled={isSubmitting}
                    emptyMessage="No contacts found. Create one in Contacts, then search again."
                  />
                )}
              />
            )}
            {issue("contact_id")}
            <Link href="/contacts/new" target="_blank" className="link mt-2 inline-block text-xs">
              Create a contact in a new tab
            </Link>
          </div>
        </div>
        {notice && (
          <p role="status" className="text-sm text-base-content/70">
            {notice}
          </p>
        )}
        {(contact || opportunity) && (
          <section className="rounded-lg border border-base-300 p-5">
            <h2 className="mb-4 font-semibold">Contact information</h2>
            <MeetingContactInformation contact={contact} opportunity={opportunity} />
            {!contact && opportunity && (
              <p className="mt-4 text-xs text-base-content/60">
                Derived from the opportunity’s primary contact, or its party when no primary is set.
              </p>
            )}
          </section>
        )}
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="meeting-time" className="mb-2 block text-sm font-medium">
              Meeting date and time (Asia/Dhaka) *
            </label>
            <input type="hidden" {...register("scheduled_at")} />
            <input
              id="meeting-time"
              type="datetime-local"
              className="input input-bordered w-full"
              value={time}
              aria-invalid={!!errors.scheduled_at}
              aria-describedby={errors.scheduled_at ? "meeting-scheduled_at-error" : undefined}
              onChange={event => {
                setTime(event.target.value);
                setValue("scheduled_at", fromDhakaDateTimeInput(event.target.value), {
                  shouldValidate: true,
                  shouldDirty: true,
                });
              }}
              onBlur={() => void trigger("scheduled_at")}
            />
            {issue("scheduled_at")}
          </div>
          <div>
            <label htmlFor="meeting-status" className="mb-2 block text-sm font-medium">
              Status *
            </label>
            <select id="meeting-status" className="select select-bordered w-full" {...input("status")}>
              <option value="scheduled">Scheduled</option>
              <option value="done">Done</option>
              <option value="cancelled">Cancelled</option>
            </select>
            {issue("status")}
          </div>
        </div>
        <div>
          <label htmlFor="meeting-description" className="mb-2 block text-sm font-medium">
            Description (optional)
          </label>
          <textarea
            id="meeting-description"
            className="textarea textarea-bordered min-h-36 w-full"
            maxLength={10000}
            placeholder="Purpose, agenda, meeting notes or Google Drive references"
            {...input("description")}
          />
          {issue("description")}
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="rounded-lg bg-error/10 p-4 text-error">
          {error}
        </p>
      )}
      <div className="flex gap-3 border-t border-base-300 pt-5">
        <button className="btn btn-primary" disabled={isSubmitting || selectingOpportunity}>
          {isSubmitting ? "Saving…" : meetingId ? "Save changes" : "Create meeting"}
        </button>
        <Link href={meetingId ? `/meetings/${meetingId}` : "/meetings"} className="btn btn-ghost">
          Cancel
        </Link>
      </div>
    </form>
  );
}

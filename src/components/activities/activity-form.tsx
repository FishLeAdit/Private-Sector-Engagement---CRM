"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  activitySchema,
  emptyActivity,
  activityTypes,
  activityTypeLabels,
  activityStatuses,
  activityStatusLabels,
  workCategories,
  workCategoryLabels,
  type ActivityFormInput,
  type ActivityInput,
} from "@/features/activities/schemas";
import type {
  ActivityOptions,
  ActivityContact,
  ActivityMeeting,
  ActivityOpportunity,
} from "@/features/activities/types";
import { fromDhakaDateTimeInput, toDhakaDateTimeInput } from "@/lib/dates";
import { ContactPicker } from "@/components/opportunities/contact-picker";
import { OpportunityPicker } from "@/components/meetings/opportunity-picker";
import { MeetingContactInformation } from "@/components/meetings/contact-information";
import { ActivityMeetingPicker } from "./meeting-picker";
export function ActivityForm({
  initial,
  activityId,
  options,
  userId,
  manager,
}: {
  initial?: ActivityInput;
  activityId?: string;
  options: ActivityOptions;
  userId: string;
  manager: boolean;
}) {
  const router = useRouter();
  const defaults = initial ?? {
    ...emptyActivity,
    owner_id: userId,
    contact_id: options.contact?.id ?? "",
    opportunity_id: options.opportunity?.id ?? "",
    meeting_id: options.meeting?.id ?? "",
  };
  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ActivityFormInput, unknown, ActivityInput>({
    resolver: zodResolver(activitySchema),
    defaultValues: defaults,
    mode: "onBlur",
  });
  const [contact, setContact] = useState<ActivityContact | null>(options.contact),
    [opportunity, setOpportunity] = useState<ActivityOpportunity | null>(options.opportunity),
    [meeting, setMeeting] = useState<ActivityMeeting | null>(options.meeting);
  const [time, setTime] = useState(toDhakaDateTimeInput(defaults.occurred_at)),
    [loadingLink, setLoadingLink] = useState(false),
    [error, setSaveError] = useState(""),
    [notice, setNotice] = useState("");
  const effectiveOpportunity = opportunity ?? meeting?.opportunity ?? null;
  const choices = effectiveOpportunity
    ? [effectiveOpportunity.contact, effectiveOpportunity.primary_contact, effectiveOpportunity.secondary_contact]
        .filter((row): row is ActivityContact => !!row)
        .filter((row, index, rows) => rows.findIndex(other => other.id === row.id) === index)
    : meeting?.contact
      ? [meeting.contact]
      : [];
  function chooseContact(row: ActivityContact | null) {
    setContact(row);
    setValue("contact_id", row?.id ?? "", { shouldValidate: true, shouldDirty: true });
  }
  function chooseOpportunity(row: ActivityOpportunity | null) {
    setOpportunity(row);
    setValue("opportunity_id", row?.id ?? "", { shouldValidate: true, shouldDirty: true });
    setNotice("");
    if (row && contact && ![row.contact_id, row.primary_contact_id, row.secondary_contact_id].includes(contact.id)) {
      chooseContact(null);
      setNotice("The previous direct contact link was cleared because it is not part of this opportunity.");
    }
  }
  function chooseMeeting(row: ActivityMeeting | null) {
    setMeeting(row);
    setValue("meeting_id", row?.id ?? "", { shouldValidate: true, shouldDirty: true });
    setNotice("");
    if (row && row.id !== meeting?.id) {
      chooseContact(null);
      chooseOpportunity(null);
      setNotice(
        "The meeting provides contact/opportunity context. Previous direct links were cleared; add compatible direct links only if needed.",
      );
    }
  }
  async function save(data: ActivityInput) {
    if (loadingLink) return;
    setSaveError("");
    try {
      const response = await fetch(activityId ? `/api/activities/${activityId}` : "/api/activities", {
        method: activityId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) {
        for (const [field, messages] of Object.entries(result.fields ?? {}) as [keyof ActivityInput, string[]][])
          if (field in emptyActivity) setError(field, { type: "server", message: messages[0] });
        setSaveError(result.error || "Activity could not be saved.");
        return;
      }
      router.push(`/activities/${result.activity.id}?saved=${activityId ? "updated" : "created"}`);
      router.refresh();
    } catch {
      setSaveError("Activity could not be saved. Check your connection and try again.");
    }
  }
  const issue = (field: keyof ActivityInput) =>
    errors[field] ? (
      <p role="alert" className="mt-1 text-sm text-error">
        {errors[field]?.message || "Use up to 20 valid HTTP(S) document URLs."}
      </p>
    ) : null;
  const input = (field: keyof ActivityInput) => ({ ...register(field), "aria-invalid": !!errors[field] });
  return (
    <form onSubmit={handleSubmit(save)} className="max-w-4xl space-y-7" noValidate>
      <p className="rounded-lg bg-info/10 p-4 text-sm">
        Log independent or linked work. Contact, opportunity and meeting links are optional. These work records do not
        create monetary achievement.
      </p>
      <fieldset disabled={isSubmitting || loadingLink} className="space-y-6">
        <legend className="sr-only">Activity details</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="activity-type" className="mb-2 block text-sm font-medium">
              Activity type *
            </label>
            <select id="activity-type" className="select select-bordered w-full" {...input("activity_type")}>
              {activityTypes.map(type => (
                <option key={type} value={type}>
                  {activityTypeLabels[type]}
                </option>
              ))}
            </select>
            {issue("activity_type")}
          </div>
          <div>
            <label htmlFor="activity-category" className="mb-2 block text-sm font-medium">
              Work category *
            </label>
            <select id="activity-category" className="select select-bordered w-full" {...input("work_category")}>
              {workCategories.map(category => (
                <option key={category} value={category}>
                  {workCategoryLabels[category]}
                </option>
              ))}
            </select>
            {issue("work_category")}
          </div>
          <div>
            <label htmlFor="activity-status" className="mb-2 block text-sm font-medium">
              Status *
            </label>
            <select id="activity-status" className="select select-bordered w-full" {...input("status")}>
              {activityStatuses.map(status => (
                <option key={status} value={status}>
                  {activityStatusLabels[status]}
                </option>
              ))}
            </select>
            {issue("status")}
          </div>
          <div>
            <label htmlFor="activity-owner" className="mb-2 block text-sm font-medium">
              Owner *
            </label>
            {manager ? (
              <select id="activity-owner" className="select select-bordered w-full" {...input("owner_id")}>
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
                  id="activity-owner"
                  readOnly
                  className="input input-bordered w-full bg-base-200"
                  value={options.owners.find(row => row.id === defaults.owner_id)?.display_name ?? "Current owner"}
                />
              </>
            )}
            {issue("owner_id")}
          </div>
        </div>
        <div>
          <label htmlFor="activity-notes" className="mb-2 block text-sm font-medium">
            Activity notes / context *
          </label>
          <textarea
            id="activity-notes"
            className="textarea textarea-bordered min-h-36 w-full"
            maxLength={10000}
            placeholder="What happened or what needs doing? Include context and Google Drive references."
            {...input("notes")}
          />
          {issue("notes")}
        </div>
        <div>
          <label htmlFor="activity-remaining" className="mb-2 block text-sm font-medium">
            Remaining work (optional)
          </label>
          <textarea
            id="activity-remaining"
            className="textarea textarea-bordered min-h-24 w-full"
            maxLength={10000}
            {...input("remaining_work")}
          />
          {issue("remaining_work")}
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="activity-person" className="mb-2 block text-sm font-medium">
              Related person
            </label>
            <input
              id="activity-person"
              className="input input-bordered w-full"
              maxLength={200}
              {...input("related_person_name")}
            />
            {issue("related_person_name")}
          </div>
          <div>
            <label htmlFor="activity-organization" className="mb-2 block text-sm font-medium">
              Related organization
            </label>
            <input
              id="activity-organization"
              className="input input-bordered w-full"
              maxLength={200}
              {...input("related_organization_name")}
            />
            {issue("related_organization_name")}
          </div>
        </div>
        <p className="text-xs text-base-content/60">
          Provide a related person or organization here, or link an existing CRM record below. Independent work needs no
          contact record or financial opportunity.
        </p>
        <div>
          <label htmlFor="activity-time" className="mb-2 block text-sm font-medium">
            Relevant date/time (optional, Asia/Dhaka)
          </label>
          <input type="hidden" {...register("occurred_at")} />
          <input
            id="activity-time"
            type="datetime-local"
            className="input input-bordered w-full"
            value={time}
            aria-invalid={!!errors.occurred_at}
            onChange={event => {
              setTime(event.target.value);
              setValue(
                "occurred_at",
                event.target.value ? fromDhakaDateTimeInput(event.target.value) || "invalid" : "",
                { shouldValidate: true, shouldDirty: true },
              );
            }}
          />
          {issue("occurred_at")}
        </div>
        <section className="space-y-5 rounded-lg border border-base-300 p-5">
          <h2 className="font-semibold">Related CRM records (optional)</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <ActivityMeetingPicker
                selected={meeting}
                onSelect={chooseMeeting}
                disabled={isSubmitting}
                onBusyChange={setLoadingLink}
              />
              {issue("meeting_id")}
            </div>
            <div>
              <OpportunityPicker
                selected={opportunity}
                onSelect={chooseOpportunity}
                disabled={isSubmitting}
                onBusyChange={setLoadingLink}
                optionsPath="/api/activities/options"
              />
              {issue("opportunity_id")}
            </div>
            <div>
              {effectiveOpportunity || meeting ? (
                <Controller
                  name="contact_id"
                  control={control}
                  render={({ field }) => (
                    <>
                      <label htmlFor="activity-contact" className="mb-2 block text-sm font-medium">
                        Contact (optional)
                      </label>
                      <select
                        id="activity-contact"
                        className="select select-bordered w-full"
                        value={field.value ?? ""}
                        ref={field.ref}
                        onBlur={field.onBlur}
                        onChange={event => chooseContact(choices.find(row => row.id === event.target.value) ?? null)}
                      >
                        <option value="">Use related record context / no direct link</option>
                        {choices.map(row => (
                          <option key={row.id} value={row.id}>
                            {row.name}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                />
              ) : (
                <Controller
                  name="contact_id"
                  control={control}
                  render={({ field }) => (
                    <ContactPicker<ActivityContact>
                      value={field.value ?? ""}
                      selected={contact}
                      onSelect={chooseContact}
                      label="Contact (optional)"
                      disabled={isSubmitting}
                      emptyMessage="No matching contacts. You can keep this activity independent."
                    />
                  )}
                />
              )}
              {issue("contact_id")}
            </div>
          </div>
          {notice && (
            <p role="status" className="text-sm text-base-content/65">
              {notice}
            </p>
          )}
          {(contact || effectiveOpportunity || meeting?.contact) && (
            <MeetingContactInformation
              contact={contact ?? meeting?.contact ?? null}
              opportunity={effectiveOpportunity}
            />
          )}
          {meeting && (
            <p className="text-xs text-base-content/60">
              Meeting: {meeting.title}. Direct links, when supplied, must remain compatible with the meeting and
              opportunity.
            </p>
          )}
        </section>
        <div>
          <label htmlFor="activity-links" className="mb-2 block text-sm font-medium">
            Document URLs (optional, one per line)
          </label>
          <Controller
            name="drive_urls"
            control={control}
            render={({ field }) => (
              <textarea
                id="activity-links"
                className="textarea textarea-bordered min-h-24 w-full"
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
            Up to 20 HTTP(S) references; Google Drive links can also be pasted into Notes. No direct uploads.
          </p>
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="rounded-lg bg-error/10 p-4 text-error">
          {error}
        </p>
      )}
      <div className="flex gap-3 border-t border-base-300 pt-5">
        <button className="btn btn-primary" disabled={isSubmitting || loadingLink}>
          {isSubmitting ? "Saving…" : activityId ? "Save changes" : "Create activity"}
        </button>
        <Link href={activityId ? `/activities/${activityId}` : "/activities"} className="btn btn-ghost">
          Cancel
        </Link>
      </div>
    </form>
  );
}

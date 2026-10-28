"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { emptyMeeting, meetingSchema, type MeetingFormInput, type MeetingInput } from "@/features/meetings/schemas";
import type { MeetingContact, MeetingOpportunity, MeetingOptions } from "@/features/meetings/types";
import { fromDhakaDateTimeInput, toDhakaDateTimeInput } from "@/lib/dates";
import { sendJson } from "@/lib/send-json";
import { applyFieldErrors, FieldError, FormActions, OwnerField } from "@/components/ui/form";
import { OpportunityPicker } from "./opportunity-picker";
import { MeetingContactInformation } from "./contact-information";
import { belongsToOpportunity } from "./contact-choices";
import { MeetingContactField } from "./meeting-contact-field";

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
  const [contact, setContact] = useState<MeetingContact | null>(options.contact);
  const [opportunity, setOpportunity] = useState<MeetingOpportunity | null>(options.opportunity);
  const [time, setTime] = useState(toDhakaDateTimeInput(defaults.scheduled_at));
  const [error, setSaveError] = useState("");
  const [notice, setNotice] = useState("");
  // True while the opportunity picker loads the chosen deal's contacts; saving waits for it.
  const [selectingOpportunity, setSelectingOpportunity] = useState(false);

  function chooseContact(row: MeetingContact | null) {
    setContact(row);
    setValue("contact_id", row?.id ?? "", { shouldValidate: true, shouldDirty: true });
  }
  function chooseOpportunity(row: MeetingOpportunity | null) {
    setOpportunity(row);
    setValue("opportunity_id", row?.id ?? "", { shouldValidate: true, shouldDirty: true });
    setNotice("");
    if (row && contact && !belongsToOpportunity(row, contact.id)) {
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
      const { ok, result } = await sendJson(
        meetingId ? `/api/meetings/${meetingId}` : "/api/meetings",
        meetingId ? "PATCH" : "POST",
        data,
      );
      if (!ok) {
        applyFieldErrors(result.fields, emptyMeeting, setError);
        setSaveError(result.error || "Meeting could not be saved.");
        return;
      }
      router.push(`/meetings/${result.meeting.id}?saved=${meetingId ? "updated" : "created"}`);
      router.refresh();
    } catch {
      setSaveError("Meeting could not be saved. Check your connection and try again.");
    }
  }
  const issue = (field: keyof MeetingInput) => <FieldError id={`meeting-${field}-error`} error={errors[field]} />;
  const input = (field: keyof MeetingInput) => ({
    ...register(field),
    "aria-invalid": !!errors[field],
    "aria-describedby": errors[field] ? `meeting-${field}-error` : undefined,
  });

  return (
    <form onSubmit={handleSubmit(save)} className="max-w-4xl space-y-7" noValidate>
      <p className="border-l-2 border-info bg-info/5 p-4 text-sm">
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
          <OwnerField
            id="meeting-owner"
            label="Owner *"
            manager={manager}
            owners={options.owners}
            ownerId={defaults.owner_id}
            placeholderName="Current owner"
            selectProps={input("owner_id")}
            hiddenProps={register("owner_id")}
            error={issue("owner_id")}
          />
          <div>
            <OpportunityPicker
              selected={opportunity}
              onSelect={chooseOpportunity}
              disabled={isSubmitting}
              onBusyChange={setSelectingOpportunity}
            />
            {issue("opportunity_id")}
          </div>
          <MeetingContactField
            control={control}
            opportunity={opportunity}
            contact={contact}
            onSelect={chooseContact}
            disabled={isSubmitting}
            error={issue("contact_id")}
          />
        </div>
        {notice && (
          <p role="status" className="text-sm text-base-content/70">
            {notice}
          </p>
        )}
        {(contact || opportunity) && (
          <section className="panel p-5">
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
      <FormActions
        error={error}
        busy={isSubmitting}
        disabled={isSubmitting || selectingOpportunity}
        submitLabel={meetingId ? "Save changes" : "Create meeting"}
        cancelHref={meetingId ? `/meetings/${meetingId}` : "/meetings"}
      />
    </form>
  );
}

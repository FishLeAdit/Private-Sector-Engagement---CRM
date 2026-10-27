"use client";
import { useState } from "react";
import { Controller, type Control, type UseFormSetValue } from "react-hook-form";
import type { ActivityFormInput, ActivityInput } from "@/features/activities/schemas";
import type {
  ActivityContact,
  ActivityMeeting,
  ActivityOpportunity,
  ActivityOptions,
} from "@/features/activities/types";
import { ContactPicker } from "@/components/opportunities/contact-picker";
import { OpportunityPicker } from "@/components/meetings/opportunity-picker";
import { MeetingContactInformation } from "@/components/meetings/contact-information";
import { belongsToOpportunity, opportunityContacts } from "@/components/meetings/contact-choices";
import { ActivityMeetingPicker } from "./meeting-picker";

// Optional links from an activity to a meeting, a deal and a contact. A meeting supplies its own
// contact/deal context, so choosing one clears direct links that might contradict it.
export function useActivityLinks(options: ActivityOptions, setValue: UseFormSetValue<ActivityFormInput>) {
  const [contact, setContact] = useState<ActivityContact | null>(options.contact);
  const [opportunity, setOpportunity] = useState<ActivityOpportunity | null>(options.opportunity);
  const [meeting, setMeeting] = useState<ActivityMeeting | null>(options.meeting);
  const [notice, setNotice] = useState("");
  const effectiveOpportunity = opportunity ?? meeting?.opportunity ?? null;
  const choices = effectiveOpportunity
    ? opportunityContacts(effectiveOpportunity)
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
    if (row && contact && !belongsToOpportunity(row, contact.id)) {
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

  return {
    contact,
    opportunity,
    meeting,
    effectiveOpportunity,
    choices,
    notice,
    chooseContact,
    chooseOpportunity,
    chooseMeeting,
  };
}

type Props = {
  links: ReturnType<typeof useActivityLinks>;
  control: Control<ActivityFormInput, unknown, ActivityInput>;
  issue: (field: keyof ActivityInput) => React.ReactNode;
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
};

export function ActivityLinksSection({ links, control, issue, disabled, onBusyChange }: Props) {
  const { contact, opportunity, meeting, effectiveOpportunity, choices, notice } = links;
  return (
    <section className="space-y-5 rounded-lg border border-base-300 p-5">
      <h2 className="font-semibold">Related CRM records (optional)</h2>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <ActivityMeetingPicker
            selected={meeting}
            onSelect={links.chooseMeeting}
            disabled={disabled}
            onBusyChange={onBusyChange}
          />
          {issue("meeting_id")}
        </div>
        <div>
          <OpportunityPicker
            selected={opportunity}
            onSelect={links.chooseOpportunity}
            disabled={disabled}
            onBusyChange={onBusyChange}
            optionsPath="/api/activities/options"
          />
          {issue("opportunity_id")}
        </div>
        <div>
          {effectiveOpportunity || meeting ? (
            // With a deal or meeting in play, only its own contact people may be linked directly.
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
                    onChange={event => links.chooseContact(choices.find(row => row.id === event.target.value) ?? null)}
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
                  onSelect={links.chooseContact}
                  label="Contact (optional)"
                  disabled={disabled}
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
        <MeetingContactInformation contact={contact ?? meeting?.contact ?? null} opportunity={effectiveOpportunity} />
      )}
      {meeting && (
        <p className="text-xs text-base-content/60">
          Meeting: {meeting.title}. Direct links, when supplied, must remain compatible with the meeting and
          opportunity.
        </p>
      )}
    </section>
  );
}

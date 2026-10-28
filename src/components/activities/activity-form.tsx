"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
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
import type { ActivityOptions } from "@/features/activities/types";
import { fromDhakaDateTimeInput, toDhakaDateTimeInput } from "@/lib/dates";
import { sendJson } from "@/lib/send-json";
import { applyFieldErrors, DocumentUrlsField, FieldError, FormActions, OwnerField } from "@/components/ui/form";
import { ActivityLinksSection, useActivityLinks } from "./activity-links";

const select = <T extends string>(values: readonly T[], labels: Record<T, string>) =>
  values.map(value => (
    <option key={value} value={value}>
      {labels[value]}
    </option>
  ));

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
  const links = useActivityLinks(options, setValue);
  const [time, setTime] = useState(toDhakaDateTimeInput(defaults.occurred_at));
  // True while a picker loads a selected record's details; saving waits so links stay consistent.
  const [loadingLink, setLoadingLink] = useState(false);
  const [error, setSaveError] = useState("");

  async function save(data: ActivityInput) {
    if (loadingLink) return;
    setSaveError("");
    try {
      const { ok, result } = await sendJson(
        activityId ? `/api/activities/${activityId}` : "/api/activities",
        activityId ? "PATCH" : "POST",
        data,
      );
      if (!ok) {
        applyFieldErrors(result.fields, emptyActivity, setError);
        setSaveError(result.error || "Activity could not be saved.");
        return;
      }
      router.push(`/activities/${result.activity.id}?saved=${activityId ? "updated" : "created"}`);
      router.refresh();
    } catch {
      setSaveError("Activity could not be saved. Check your connection and try again.");
    }
  }
  const issue = (field: keyof ActivityInput) => (
    <FieldError error={errors[field]} fallback="Use up to 20 valid HTTP(S) document URLs." />
  );
  const input = (field: keyof ActivityInput) => ({ ...register(field), "aria-invalid": !!errors[field] });

  return (
    <form onSubmit={handleSubmit(save)} className="max-w-4xl space-y-7" noValidate>
      <p className="border-l-2 border-info bg-info/5 p-4 text-sm">
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
              {select(activityTypes, activityTypeLabels)}
            </select>
            {issue("activity_type")}
          </div>
          <div>
            <label htmlFor="activity-category" className="mb-2 block text-sm font-medium">
              Work category *
            </label>
            <select id="activity-category" className="select select-bordered w-full" {...input("work_category")}>
              {select(workCategories, workCategoryLabels)}
            </select>
            {issue("work_category")}
          </div>
          <div>
            <label htmlFor="activity-status" className="mb-2 block text-sm font-medium">
              Status *
            </label>
            <select id="activity-status" className="select select-bordered w-full" {...input("status")}>
              {select(activityStatuses, activityStatusLabels)}
            </select>
            {issue("status")}
          </div>
          <OwnerField
            id="activity-owner"
            label="Owner *"
            manager={manager}
            owners={options.owners}
            ownerId={defaults.owner_id}
            placeholderName="Current owner"
            selectProps={input("owner_id")}
            hiddenProps={register("owner_id")}
            error={issue("owner_id")}
          />
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
              // An unparseable entry becomes "invalid" so validation reports it rather than silently clearing it.
              setValue(
                "occurred_at",
                event.target.value ? fromDhakaDateTimeInput(event.target.value) || "invalid" : "",
                { shouldValidate: true, shouldDirty: true },
              );
            }}
          />
          {issue("occurred_at")}
        </div>
        <ActivityLinksSection
          links={links}
          control={control}
          issue={issue}
          disabled={isSubmitting}
          onBusyChange={setLoadingLink}
        />
        <DocumentUrlsField
          control={control}
          name="drive_urls"
          id="activity-links"
          label="Document URLs (optional, one per line)"
          className="textarea textarea-bordered min-h-24 w-full"
          hint="Up to 20 HTTP(S) references; Google Drive links can also be pasted into Notes. No direct uploads."
          error={issue("drive_urls")}
        />
      </fieldset>
      <FormActions
        error={error}
        busy={isSubmitting}
        disabled={isSubmitting || loadingLink}
        submitLabel={activityId ? "Save changes" : "Create activity"}
        cancelHref={activityId ? `/activities/${activityId}` : "/activities"}
      />
    </form>
  );
}

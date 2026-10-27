import {
  activityTypes,
  activityTypeLabels,
  workCategories,
  workCategoryLabels,
  activityStatuses,
  activityStatusLabels,
  type ActivityListInput,
} from "@/features/activities/schemas";
import type { ActivityOptions } from "@/features/activities/types";
import { FilterForm, FilterInput, FilterSelect, labelOptions, ownerOptions } from "@/components/ui/filters";

// A list opened from a contact, deal or meeting stays limited to records linked directly to it.
export function ActivityFilters({ input, options }: { input: ActivityListInput; options: ActivityOptions }) {
  const linked = [options.contact?.name, options.opportunity?.deal_name, options.meeting?.title].filter(Boolean);
  return (
    <FilterForm
      action="/activities"
      hidden={{ contact_id: input.contact_id, opportunity_id: input.opportunity_id, meeting_id: input.meeting_id }}
      note={
        linked.length > 0 && <p className="mt-4 text-sm text-base-content/65">Direct links: {linked.join(" · ")}</p>
      }
    >
      <FilterInput label="Search notes / related context" name="q" value={input.q} maxLength={100} />
      <FilterSelect
        label="Activity type"
        name="activity_type"
        value={input.activity_type}
        allValue="all"
        allLabel="All types"
        options={labelOptions(activityTypes, activityTypeLabels)}
      />
      <FilterSelect
        label="Work category"
        name="work_category"
        value={input.work_category}
        allValue="all"
        allLabel="All categories"
        options={labelOptions(workCategories, workCategoryLabels)}
      />
      <FilterSelect
        label="Status"
        name="status"
        value={input.status}
        allValue="all"
        allLabel="All statuses"
        options={labelOptions(activityStatuses, activityStatusLabels)}
      />
      <FilterSelect
        label="Owner"
        name="owner_id"
        value={input.owner_id}
        allLabel="All owners"
        options={ownerOptions(options.owners)}
      />
      <FilterInput label="Relevant date from (Dhaka)" name="from" value={input.from} type="date" />
      <FilterInput label="Relevant date to (Dhaka)" name="to" value={input.to} type="date" />
    </FilterForm>
  );
}

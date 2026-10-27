import type { MeetingListInput } from "@/features/meetings/schemas";
import type { MeetingOptions } from "@/features/meetings/types";
import { FilterForm, FilterInput, FilterSelect, ownerOptions } from "@/components/ui/filters";

// A list opened from a contact or deal stays limited to meetings linked directly to it.
export function MeetingFilters({ input, options }: { input: MeetingListInput; options: MeetingOptions }) {
  return (
    <FilterForm
      action="/meetings"
      hidden={{ contact_id: input.contact_id, opportunity_id: input.opportunity_id }}
      columns="lg:grid-cols-3"
      note={
        (options.contact || options.opportunity) && (
          <p className="mt-4 text-sm text-base-content/65">
            {options.contact && `Direct contact link: ${options.contact.name}. `}
            {options.opportunity && `Opportunity: ${options.opportunity.deal_name}.`}
          </p>
        )
      }
    >
      <FilterInput label="Meeting title" name="q" value={input.q} maxLength={100} placeholder="Search meetings" />
      <FilterSelect
        label="View"
        name="period"
        value={input.period}
        allValue="all"
        allLabel="All meetings"
        options={[
          { value: "upcoming", label: "Upcoming scheduled" },
          { value: "completed", label: "Completed" },
        ]}
      />
      <FilterSelect
        label="Status"
        name="status"
        value={input.status}
        allValue="all"
        allLabel="All statuses"
        options={[
          { value: "scheduled", label: "Scheduled" },
          { value: "done", label: "Done" },
          { value: "cancelled", label: "Cancelled" },
        ]}
      />
      <FilterSelect
        label="Owner"
        name="owner_id"
        value={input.owner_id}
        allLabel="All owners"
        options={ownerOptions(options.owners)}
      />
      <FilterInput label="Meeting date from (Dhaka)" name="from" value={input.from} type="date" />
      <FilterInput label="Meeting date to (Dhaka)" name="to" value={input.to} type="date" />
    </FilterForm>
  );
}

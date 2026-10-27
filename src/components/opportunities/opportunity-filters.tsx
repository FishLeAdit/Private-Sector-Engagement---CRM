import type { OpportunityListInput } from "@/features/opportunities/schemas";
import type { OpportunityOptions } from "@/features/opportunities/types";
import { FilterForm, FilterInput, FilterSelect } from "@/components/ui/filters";

const named = (rows: { id: string; name: string }[]) => rows.map(row => ({ value: row.id, label: row.name }));

export function OpportunityFilters({
  input,
  view,
  options,
}: {
  input: OpportunityListInput;
  view: string;
  options: OpportunityOptions;
}) {
  return (
    <FilterForm action="/opportunities" hidden={{ view, contact_id: input.contact_id }}>
      <FilterInput label="Deal name" name="q" value={input.q} maxLength={100} placeholder="Search deals" />
      <FilterSelect
        label="Stage"
        name="stage_id"
        value={input.stage_id}
        allLabel="All"
        options={named(options.stages)}
      />
      <FilterSelect
        label="Focal person"
        name="owner_id"
        value={input.owner_id}
        allLabel="All"
        options={options.owners.map(row => ({ value: row.id, label: row.display_name }))}
      />
      <FilterSelect
        label="Category"
        name="contribution_category_id"
        value={input.contribution_category_id}
        allLabel="All"
        options={named(options.categories)}
      />
      <FilterSelect
        label="Contribution type"
        name="contribution_type"
        value={input.contribution_type}
        allLabel="All"
        options={[
          { value: "cash", label: "Cash" },
          { value: "valued_in_kind", label: "Valued in-kind" },
        ]}
      />
      <FilterInput label="Currency" name="currency" value={input.currency} maxLength={3} placeholder="e.g. BDT" />
      <FilterInput label="Closing from" name="from" value={input.from} type="date" />
      <FilterInput label="Closing to" name="to" value={input.to} type="date" />
    </FilterForm>
  );
}

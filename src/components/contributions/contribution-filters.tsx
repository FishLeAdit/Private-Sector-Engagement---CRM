import type { ContributionFilters as Filters } from "@/features/contributions/schemas";
import type { FinanceOptions } from "@/features/finance/types";
import { FilterForm, FilterInput, FilterSelect } from "@/components/ui/filters";

// A list opened from a deal ("View contributions") stays limited to that deal's receipts.
export function ContributionFilters({ input, options }: { input: Filters; options: FinanceOptions }) {
  return (
    <FilterForm action="/contributions" hidden={{ opportunity_id: input.opportunity_id }} columns="lg:grid-cols-5">
      <FilterSelect
        label="Employee"
        name="employee_id"
        value={input.employee_id}
        allLabel="All employees"
        options={options.employees.map(e => ({ value: e.id, label: e.display_name }))}
      />
      <FilterSelect
        label="Vertical"
        name="target_vertical_id"
        value={input.target_vertical_id}
        allLabel="All verticals"
        options={options.verticals.map(v => ({ value: v.id, label: v.name }))}
      />
      <FilterInput label="Currency" name="currency" value={input.currency} maxLength={3} />
      <FilterInput label="Recognition date from (Dhaka)" name="from" value={input.from} type="date" />
      <FilterInput label="Recognition date to (Dhaka)" name="to" value={input.to} type="date" />
    </FilterForm>
  );
}

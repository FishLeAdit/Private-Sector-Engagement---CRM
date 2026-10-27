import Link from "next/link";

// A GET form for list filters, so filtered lists can be bookmarked and shared. Hidden values keep a list
// scoped to a linked record (for example one contact's meetings) while other filters change.
export function FilterForm({
  action,
  hidden = {},
  columns = "lg:grid-cols-4",
  note,
  children,
}: {
  action: string;
  hidden?: Record<string, string>;
  columns?: string;
  note?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <form action={action} className="mb-5 rounded-xl border border-base-300 p-4">
      {Object.entries(hidden).map(([name, value]) =>
        value ? <input key={name} type="hidden" name={name} value={value} /> : null,
      )}
      <div className={`grid gap-3 sm:grid-cols-2 ${columns}`}>{children}</div>
      {note}
      <div className="mt-4 flex gap-2">
        <button className="btn btn-outline btn-sm">Apply filters</button>
        <Link href={action} className="btn btn-ghost btn-sm">
          Reset
        </Link>
      </div>
    </form>
  );
}

export function FilterSelect({
  label,
  name,
  value,
  allLabel,
  allValue = "",
  options,
}: {
  label: string;
  name: string;
  value: string;
  allLabel: string;
  allValue?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block text-xs">
      {label}
      <select name={name} defaultValue={value} className="select select-bordered mt-1 w-full">
        <option value={allValue}>{allLabel}</option>
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FilterInput({
  label,
  name,
  value,
  type,
  maxLength,
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  type?: "date";
  maxLength?: number;
  placeholder?: string;
}) {
  return (
    <label className="block text-xs">
      {label}
      <input
        type={type}
        name={name}
        defaultValue={value}
        maxLength={maxLength}
        placeholder={placeholder}
        className="input input-bordered mt-1 w-full"
      />
    </label>
  );
}

// Helpers that turn lookup rows into filter options.
export const ownerOptions = (owners: { id: string; display_name: string; active: boolean }[]) =>
  owners.map(owner => ({ value: owner.id, label: `${owner.display_name}${owner.active ? "" : " (inactive)"}` }));

export const labelOptions = <T extends string>(values: readonly T[], labels: Record<T, string>) =>
  values.map(value => ({ value, label: labels[value] }));

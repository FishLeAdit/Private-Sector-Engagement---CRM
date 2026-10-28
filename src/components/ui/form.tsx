import Link from "next/link";
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
  type Path,
  type UseFormRegisterReturn,
  type UseFormSetError,
} from "react-hook-form";

// Shared building blocks for the record forms (contacts, deals, meetings, activities).

// Shown under a field. `fallback` covers errors without a message, such as a nested URL-list error.
export function FieldError({ id, error, fallback }: { id?: string; error?: { message?: string }; fallback?: string }) {
  if (!error) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-sm text-error">
      {error.message || fallback}
    </p>
  );
}

// Puts server-side field errors back on the matching inputs; unknown field names are ignored.
export function applyFieldErrors<T extends FieldValues>(
  fields: Record<string, string[]> | undefined,
  knownFields: object,
  setError: UseFormSetError<T>,
) {
  for (const [field, messages] of Object.entries(fields ?? {}))
    if (field in knownFields) setError(field as Path<T>, { type: "server", message: messages[0] });
}

type Owner = { id: string; display_name: string; active: boolean };

// Managers may assign any active owner; everyone else sees the current owner read-only.
// An inactive current owner stays selectable so historical records still display correctly.
export function OwnerField({
  id,
  label,
  manager,
  owners,
  ownerId,
  placeholderName,
  selectProps,
  hiddenProps,
  error,
}: {
  id: string;
  label: string;
  manager: boolean;
  owners: Owner[];
  ownerId: string;
  placeholderName: string;
  selectProps: React.SelectHTMLAttributes<HTMLSelectElement>;
  hiddenProps: UseFormRegisterReturn;
  error: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium">
        {label}
      </label>
      {manager ? (
        <select id={id} className="select select-bordered w-full" {...selectProps}>
          <option value="">Choose…</option>
          {owners
            .filter(row => row.active || row.id === ownerId)
            .map(row => (
              <option key={row.id} value={row.id}>
                {row.display_name}
                {!row.active && " (inactive)"}
              </option>
            ))}
        </select>
      ) : (
        <>
          <input type="hidden" {...hiddenProps} />
          <input
            id={id}
            readOnly
            className="input input-bordered w-full bg-base-200"
            value={owners.find(row => row.id === ownerId)?.display_name ?? placeholderName}
          />
        </>
      )}
      {error}
    </div>
  );
}

// Reference links typed one per line and stored as a list. No files are uploaded.
export function DocumentUrlsField<T extends FieldValues, U>({
  control,
  name,
  id,
  label,
  hint,
  className,
  error,
}: {
  control: Control<T, unknown, U>;
  name: FieldPath<T>;
  id: string;
  label: string;
  hint: string;
  className: string;
  error: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium">
        {label}
      </label>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <textarea
            id={id}
            className={className}
            value={(field.value as string[] | undefined)?.join("\n") ?? ""}
            onChange={event => field.onChange(event.target.value.split("\n"))}
            onBlur={field.onBlur}
            ref={field.ref}
            placeholder="https://drive.google.com/…"
          />
        )}
      />
      {error}
      <p className="mt-1 text-xs text-base-content/60">{hint}</p>
    </div>
  );
}

// The save error (if any), then Save and Cancel. Cancel is a link, or a button when the form sits in a dialog.
export function FormActions({
  error,
  busy,
  disabled,
  submitLabel,
  cancelHref,
  onCancel,
}: {
  error: string;
  busy: boolean;
  disabled: boolean;
  submitLabel: string;
  cancelHref?: string;
  onCancel?: () => void;
}) {
  return (
    <>
      {error && (
        <p role="alert" className="border-l-2 border-error bg-error/5 p-4 text-error">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3 border-t border-base-300 pt-5">
        <button className="btn btn-primary" type="submit" disabled={disabled}>
          {busy ? "Saving…" : submitLabel}
        </button>
        {onCancel ? (
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
        ) : (
          <Link href={cancelHref ?? "/"} className="btn btn-ghost">
            Cancel
          </Link>
        )}
      </div>
    </>
  );
}

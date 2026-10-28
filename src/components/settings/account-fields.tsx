import { accountRoles } from "@/features/accounts/schemas";
import { roleLabels } from "@/lib/auth/roles";

export const roleOptionLabels: Record<(typeof accountRoles)[number], string> = {
  pse_member: `${roleLabels.pse_member} (staff)`,
  pse_manager: `${roleLabels.pse_manager} (targets, configuration, assigning owners)`,
  admin: `${roleLabels.admin} (everything, including accounts)`,
};

// Name, department and role, shared by the create and edit forms. Only the PSE department can use the CRM.
export function ProfileFields({
  values,
  lockAccess = false,
}: {
  values?: { display_name: string; department: string; role: string };
  lockAccess?: boolean;
}) {
  return (
    <>
      <label className="block text-sm">
        Name *
        <input
          name="display_name"
          required
          maxLength={200}
          defaultValue={values?.display_name}
          className="input input-bordered mt-2 w-full"
        />
      </label>
      <div className="text-sm">
        <label htmlFor="account-department" className="block">
          Department *
        </label>
        <input
          id="account-department"
          name="department"
          required
          maxLength={100}
          readOnly={lockAccess}
          defaultValue={values?.department ?? "PSE"}
          aria-describedby="account-department-hint"
          className="input input-bordered mt-2 w-full"
        />
        <p id="account-department-hint" className="mt-1 text-xs text-muted">
          Only PSE accounts can use the CRM. Another department makes a restricted account.
        </p>
      </div>
      <label className="block text-sm">
        Role *
        <select
          name="role"
          defaultValue={values?.role ?? "pse_member"}
          disabled={lockAccess}
          className="select select-bordered mt-2 w-full"
        >
          {accountRoles.map(role => (
            <option key={role} value={role}>
              {roleOptionLabels[role]}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

// Sends JSON and returns the error text to show, or "" on success.
export async function sendAccount(url: string, method: string, body: unknown) {
  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(body),
    });
    if (response.ok) return "";
    const data = await response.json();
    return `${data.error || "The change could not be saved."} ${Object.values(data.fields ?? {})
      .flat()
      .join(" ")}`.trim();
  } catch {
    return "The change could not be saved. Check your connection and try again.";
  }
}

import Link from "next/link";
import type { Account } from "@/features/accounts/types";
import { roleLabels, type PseRole } from "@/lib/auth/roles";
import { formatDate } from "@/lib/dates";
import { StatusPip, type Tone } from "@/components/ui/hud";

// Whether the account can use the CRM right now, as a labelled status.
export function accountStatus(account: Account): { tone: Tone; label: string } {
  if (!account.display_name) return { tone: "warning", label: "No CRM profile" };
  if (!account.active) return { tone: "critical", label: "Restricted" };
  if (account.department !== "PSE") return { tone: "idle", label: "Not PSE" };
  return { tone: "nominal", label: "Active" };
}

export function AccountsTable({ accounts, selfId }: { accounts: Account[]; selfId: string }) {
  return (
    <div className="overflow-x-auto panel">
      <table className="table">
        <thead>
          <tr>
            <th>Name / email</th>
            <th>Role</th>
            <th>Department</th>
            <th>Status</th>
            <th>Last sign-in</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map(account => {
            const status = accountStatus(account);
            return (
              <tr key={account.id}>
                <td>
                  <Link className="link font-medium" href={`/settings/accounts/${account.id}`}>
                    {account.display_name ?? account.email}
                  </Link>
                  {account.id === selfId && <span className="ml-2 text-xs text-muted">(you)</span>}
                  <p className="mt-1 break-all text-xs text-muted">{account.email}</p>
                </td>
                <td>{account.role ? (roleLabels[account.role as PseRole] ?? account.role) : "—"}</td>
                <td>{account.department ?? "—"}</td>
                <td>
                  <StatusPip tone={status.tone} label={status.label} />
                </td>
                <td className="whitespace-nowrap">
                  {account.last_sign_in_at ? formatDate(account.last_sign_in_at, true) : "Never"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

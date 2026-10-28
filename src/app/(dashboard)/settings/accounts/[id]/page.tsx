import Link from "next/link";
import { notFound } from "next/navigation";
import { accountsPageContext, accountsPageData } from "@/features/accounts/context";
import { isSuperadmin } from "@/lib/auth/roles";
import { formatDate } from "@/lib/dates";
import { AccountEditor, PasswordForm } from "@/components/settings/account-editor";
import { accountStatus } from "@/components/settings/accounts-table";
import { ConfirmDeleteButton } from "@/components/ui/confirm-delete-button";
import { PageProblem } from "@/components/ui/page-problem";
import { Notice, StatusPip, SysCode } from "@/components/ui/hud";

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { service, access } = await accountsPageContext();
  if (!isSuperadmin(access.profile)) notFound();
  const { id } = await params;
  const result = await accountsPageData(() => service.list());
  if (!result.ok)
    return (
      <PageProblem
        title="Account could not be loaded"
        message={result.error.message}
        links={[{ href: "/settings/accounts", label: "Accounts" }]}
      />
    );
  const account = result.data.find(row => row.id === id);
  if (!account) notFound();
  const self = account.id === access.userId,
    status = accountStatus(account);
  return (
    <>
      <Link href="/settings/accounts" className="link text-sm">
        ← Accounts
      </Link>
      <SysCode className="mt-4 mb-1 block">{`SYS.CFG // ACCOUNT // ${id.slice(0, 8).toUpperCase()}`}</SysCode>
      <h1 className="break-words text-3xl font-bold">{account.display_name ?? account.email}</h1>
      <p className="mt-2 mb-6 flex flex-wrap items-center gap-3 text-sm text-muted">
        <StatusPip tone={status.tone} label={status.label} />
        <span className="break-all">{account.email}</span>
        <span>Last sign-in: {account.last_sign_in_at ? formatDate(account.last_sign_in_at, true) : "never"}</span>
      </p>
      {!service.canChangeSignIn && (
        <div className="mb-6 max-w-3xl">
          <Notice tone="warning">
            Setting passwords and removing sign-ins need SUPABASE_SERVICE_ROLE_KEY on the server.
          </Notice>
        </div>
      )}
      <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
        <AccountEditor account={account} self={self} />
        <div className="space-y-6">
          <PasswordForm id={account.id} disabled={!service.canChangeSignIn} />
          {!self && (
            <section className="space-y-3 panel p-6" aria-labelledby="delete-account">
              <h2 id="delete-account" className="font-mono text-sm font-semibold">
                Delete account
              </h2>
              <p className="text-sm text-muted">
                Only an account with no records or history in the CRM can be deleted. Restrict the others instead, so
                their work stays attributed.
              </p>
              <ConfirmDeleteButton
                noun="account"
                name={account.display_name ?? account.email}
                endpoint={`/api/accounts/${account.id}`}
                redirectTo="/settings/accounts"
                consequences="The profile and the sign-in account are removed. This is refused if the account owns or created any record."
              />
            </section>
          )}
        </div>
      </div>
    </>
  );
}

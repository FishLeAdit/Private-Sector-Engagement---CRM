import Link from "next/link";
import { accountsPageContext, accountsPageData } from "@/features/accounts/context";
import { isSuperadmin } from "@/lib/auth/roles";
import { AccountsTable } from "@/components/settings/accounts-table";
import { CreateAccountForm } from "@/components/settings/create-account-form";
import { PageProblem } from "@/components/ui/page-problem";
import { Notice, SysCode } from "@/components/ui/hud";

export default async function AccountsPage() {
  const { service, access } = await accountsPageContext();
  const superadmin = isSuperadmin(access.profile);
  const result = superadmin ? await accountsPageData(() => service.list()) : null;
  return (
    <>
      <Link href="/settings" className="link text-sm">
        ← Settings
      </Link>
      <SysCode className="mt-4 mb-1 block">{`SYS.CFG // ACCOUNTS${result?.ok ? ` // ${result.data.length}` : ""}`}</SysCode>
      <h1 className="mb-3 text-3xl font-bold">Accounts</h1>
      <p className="mb-6 max-w-3xl text-muted">
        Sign-in accounts and their CRM access. Staff work in the CRM, managers also run targets and configuration, and a
        superadmin also manages accounts.
      </p>
      {!superadmin ? (
        <Notice role="status">Only a superadmin can manage accounts.</Notice>
      ) : !result?.ok ? (
        <PageProblem
          title="Accounts could not be loaded"
          message={result?.error.message ?? "Accounts are unavailable."}
          links={[{ href: "/settings/accounts", label: "Try again" }]}
        />
      ) : (
        <>
          {!service.canChangeSignIn && (
            <div className="mb-6 max-w-3xl">
              <Notice tone="warning">
                Creating accounts, setting passwords and removing sign-ins need SUPABASE_SERVICE_ROLE_KEY on the server.
                Profiles can still be edited and restricted.
              </Notice>
            </div>
          )}
          <CreateAccountForm disabled={!service.canChangeSignIn} />
          <AccountsTable accounts={result.data} selfId={access.userId} />
        </>
      )}
    </>
  );
}

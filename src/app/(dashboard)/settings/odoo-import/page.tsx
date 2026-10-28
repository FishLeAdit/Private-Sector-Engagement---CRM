import Link from "next/link";
import { requirePseUser } from "@/lib/auth/access";
import { isPseManager } from "@/lib/auth/roles";
import { OdooImportCheck } from "@/components/settings/odoo-import-check";
import { Notice, SysCode } from "@/components/ui/hud";

export default async function OdooImportPage() {
  const access = await requirePseUser();
  return (
    <>
      <Link href="/settings" className="link text-sm">
        ← Settings
      </Link>
      <SysCode className="mt-4 mb-1 block">{"SYS.CFG // ODOO"}</SysCode>
      <h1 className="mb-3 text-3xl font-bold">Odoo import check</h1>
      <p className="mb-5 max-w-3xl text-muted">
        Check exported contacts, deals and activities against the CRM&apos;s own rules before any import. The check only
        reads: files are not stored, and nothing is imported or changed.
      </p>
      <div className="mb-6 max-w-3xl">
        <Notice tone="warning">
          Awaiting PSE field mapping. The columns and value mappings are a proposal, so a clean result is not approval
          to import real data. See the open questions in the migration plan (docs/08).
        </Notice>
      </div>
      {isPseManager(access.profile) ? (
        <OdooImportCheck />
      ) : (
        <Notice role="status">Only a PSE manager can run the Odoo import check.</Notice>
      )}
    </>
  );
}

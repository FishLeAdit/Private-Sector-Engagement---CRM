import { expect, liveEnabled, liveSkipReason, qaName, signIn, test } from "../helpers/live";

test.skip(!liveEnabled, liveSkipReason);
test.describe.configure({ timeout: 120_000 });

// Read-only: the check stores nothing, and the pipeline page is only opened.
test("the account menu leads to Settings, its pipeline page and the Odoo import check", async ({ page }) => {
  await signIn(page);
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await expect(nav.getByRole("link", { name: "Settings" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "PSE CRM" })).toBeVisible();
  const account = page.getByRole("button", { name: /account menu$/ });
  await account.click();
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeHidden();
  await account.click();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible({ timeout: 30000 });

  await page.getByRole("link", { name: "Open pipeline settings" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Pipeline settings" })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole("heading", { level: 2, name: "Stages" })).toBeVisible();
  await page.getByRole("link", { name: "← Settings" }).click();

  await page.getByRole("link", { name: "Open the import check" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Odoo import check" })).toBeVisible({ timeout: 30000 });
  const check = page.getByRole("button", { name: "Check the mixed samples" });
  test.skip(!(await check.count()), "This account is not a PSE manager, so it cannot run the check.");
  await check.click();
  await expect(page.getByRole("heading", { name: "Results for the mixed samples" })).toBeVisible({ timeout: 30000 });
  const contacts = page.getByRole("region", { name: "Contacts" });
  await expect(contacts.getByText("same as line 3 (res_partner_102)", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Import/ })).toHaveCount(0);
});

// Read-only: the forms are opened but never submitted, and account writes are blocked by the fixture.
test("a superadmin sees every account and can open one to manage it", async ({ page }) => {
  await signIn(page);
  await page.goto("/settings/accounts");
  await expect(page.getByRole("heading", { level: 1, name: "Accounts" })).toBeVisible({ timeout: 30000 });
  test.skip(
    (await page.getByText("Only a superadmin can manage accounts.").count()) > 0,
    "This account is not the superadmin.",
  );
  for (const name of ["Farzana Rahman", "Tanvir Hasan", "Nusrat Jahan", "Arif Chowdhury", "Sadia Islam"])
    await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
  await expect(page.getByText("(you)")).toBeVisible();
  await page.getByRole("link", { name: "Farzana Rahman", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Farzana Rahman" })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole("form", { name: "Profile and access" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete account" })).toBeVisible();
});

// Imports a one-off QA batch (one contact, deal and activity), then the fixture deletes all three.
test("files with nothing to review can be imported once", async ({ page, qa }) => {
  await signIn(page);
  const stamp = Date.now(),
    donor = qaName("Odoo donor"),
    deal = qaName("Odoo deal");
  const csv = (header: string, row: string) => Buffer.from(`${header}\n${row}\n`);
  await page.goto("/settings/odoo-import");
  await expect(page.getByRole("heading", { level: 1, name: "Odoo import check" })).toBeVisible({ timeout: 30000 });
  const files = page.getByRole("form", { name: "Files to check" });
  test.skip(!(await files.count()), "This account is not a PSE manager, so it cannot import.");
  await page.getByLabel(/^Contacts/).setInputFiles({
    name: "contacts.csv",
    mimeType: "text/csv",
    buffer: csv(
      "odoo_id,is_company,name,parent_odoo_id,function,email,phone,mobile,website,industry,comment",
      `qa_partner_${stamp},FALSE,${donor},,,qa-odoo-${stamp}@example.invalid,,,,,`,
    ),
  });
  await page.getByLabel(/^Deals/).setInputFiles({
    name: "deals.csv",
    mimeType: "text/csv",
    buffer: csv(
      "odoo_id,name,partner_odoo_id,contact_odoo_id,salesperson,stage,tag,contribution_type,expected_revenue,currency,date_deadline,country,description,valuation_note",
      `qa_lead_${stamp},${deal},qa_partner_${stamp},,Nusrat Jahan,New,GENERAL,cash,1000,BDT,,Bangladesh,,`,
    ),
  });
  await page.getByLabel(/^Activities/).setInputFiles({
    name: "activities.csv",
    mimeType: "text/csv",
    buffer: csv(
      "odoo_id,activity_type,work_category,status,date,assigned_to,partner_odoo_id,deal_odoo_id,related_person,related_organization,summary,note,remaining_work",
      `qa_activity_${stamp},Call,prospect_engagement,done,2026-10-28 10:00,Nusrat Jahan,qa_partner_${stamp},qa_lead_${stamp},,,${qaName("Odoo call")},,`,
    ),
  });
  await page.getByRole("button", { name: "Check files" }).click();
  const run = page.getByRole("button", { name: "Import 1 contact, 1 deal, 1 activity" });
  await expect(run).toBeVisible({ timeout: 30000 });
  const response = page.waitForResponse(r => r.url().endsWith("/api/settings/odoo-import"));
  await run.click();
  const { result } = await (await response).json();
  for (const id of result.contacts) qa.track(`/contacts/${id}`);
  for (const id of result.deals) qa.track(`/opportunities/${id}`);
  for (const id of result.activities) qa.track(`/activities/${id}`);
  await expect(page.getByText("Imported 1 contact, 1 deal, 1 activity.")).toBeVisible({ timeout: 30000 });

  // The same files are now refused: their Odoo IDs and the contact's email are already in the CRM.
  await page.getByRole("button", { name: "Check more files" }).click();
  await page.getByRole("button", { name: "Check files" }).click();
  await expect(page.getByText("already imported into the CRM", { exact: false }).first()).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByRole("button", { name: /^Import/ })).toHaveCount(0);
  await page.goto(`/opportunities/${result.deals[0]}`);
  await expect(page.getByRole("heading", { level: 1, name: deal })).toBeVisible({ timeout: 30000 });
});

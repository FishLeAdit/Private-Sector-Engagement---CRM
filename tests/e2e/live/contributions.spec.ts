import { expect, heading, liveEnabled, liveSkipReason, qaName, recordPath, signIn, test } from "../helpers/live";

test.skip(!liveEnabled, liveSkipReason);
test.describe.configure({ timeout: 180_000 });

type Stage = { id: string; name: string; is_closed: boolean; outcome: string | null; active: boolean };

// Contributions cannot be deleted, so the save request is blocked: this checks the form and the stage rule only.
test("an open deal offers the contribution form and a closed, not-won deal refuses new receipts", async ({
  page,
  qa,
}) => {
  await signIn(page);
  const body = await (await page.request.get("/api/opportunities/options")).json();
  const stages: Stage[] = (body.data ?? body).stages;
  const closed = stages.find(stage => stage.active && stage.is_closed && stage.outcome !== "won");
  test.skip(!closed, "No active closed, not-won stage is configured.");
  const names = { contact: qaName("Donor"), deal: qaName("Receipt deal") };

  await page.goto("/contacts/new");
  await page.getByLabel("Contact name").fill(names.contact);
  await page.getByLabel("Email address").fill(`qa-donor-${Date.now()}@example.invalid`);
  await page.getByRole("button", { name: "Create contact", exact: true }).click();
  await expect(heading(page, names.contact)).toBeVisible({ timeout: 30000 });
  qa.track(recordPath(page));

  await page.goto("/opportunities/new");
  await page.getByLabel("Deal name *").fill(names.deal);
  await page.getByLabel("Contribution category *").selectOption({ index: 1 });
  // The deal form labels stages with a "(provisional)" suffix, so select by ID.
  await page.getByLabel("Stage *").selectOption(stages.find(s => s.active && !s.is_closed)!.id);
  await page.getByRole("combobox", { name: "Individual / company" }).fill(names.contact);
  await page.getByRole("option").filter({ hasText: names.contact }).getByRole("button").click();
  await page.getByLabel("Budgeted fund (expected value) *").fill("1000.00");
  await page.getByRole("button", { name: "Create deal", exact: true }).click();
  await expect(heading(page, names.deal)).toBeVisible({ timeout: 30000 });
  const deal = recordPath(page);
  qa.track(deal);

  // Open deal: the form is offered. This account's own name is the starting attribution either way
  // (a manager gets a picker starting from the focal person, who is this account; a member gets a fixed field).
  await page.getByRole("link", { name: "Record contribution", exact: true }).click();
  await expect(heading(page, "Record contribution")).toBeVisible({ timeout: 30000 });
  const attribution = page.getByLabel("Attributed employee *");
  await expect(attribution).toBeVisible();
  await page.getByLabel("Actual amount received / agreed value *").fill("1.00");
  await page.getByLabel("Recognition date/time (Asia/Dhaka) *").fill("2026-10-28T10:00");
  await page.getByRole("button", { name: "Review contribution", exact: true }).click();
  await page.getByRole("button", { name: "Confirm and record contribution", exact: true }).click();
  await expect(page.getByText(/The result is uncertain/)).toBeVisible({ timeout: 30000 });
  expect(qa.blocked).toEqual(["POST /api/contributions"]);

  // Closed without winning: no button on the deal, and the form page explains why.
  await page.goto(deal);
  await page.getByLabel("Move to stage").selectOption({ label: closed!.name });
  await page.getByRole("button", { name: "Move", exact: true }).click();
  await expect(page.getByText(new RegExp(`Stage: .+ → ${closed!.name}`))).toBeVisible({ timeout: 30000 });
  await page.reload();
  await expect(page.getByRole("link", { name: "Record contribution", exact: true })).toHaveCount(0);
  await page.goto(`/contributions/new?opportunity_id=${deal.split("/").pop()}`);
  await expect(page.getByRole("alert").filter({ hasText: "can only be recorded on open or won deals" })).toBeVisible();
  await expect(page.getByLabel("Actual amount received / agreed value *")).toHaveCount(0);
});

// Corrections are permanent too, so the save request is blocked: this opens an existing demo receipt, checks
// the panel and walks the manager's correction form up to the blocked request. Nothing is created.
test("a manager can open the correction form on an existing receipt", async ({ page, qa }) => {
  await signIn(page);
  const body = await (await page.request.get("/api/contributions")).json();
  const receipt = ((body.data ?? body).contributions as { id: string; corrects_contribution_id: string | null }[]).find(
    row => !row.corrects_contribution_id,
  );
  test.skip(!receipt, "The demo project has no recognized contribution to open.");
  await page.goto(`/contributions/${receipt!.id}`);
  await expect(page.getByRole("heading", { level: 2, name: "Corrections" })).toBeVisible({ timeout: 30000 });
  const amount = page.getByLabel(/^Amount to reverse/);
  test.skip(!(await amount.count()), "This account is not a PSE manager, so it is not offered the correction form.");
  await amount.fill("0.01");
  await page.getByLabel("Reason for the correction *").fill(qaName("Correction check"));
  await page.getByRole("button", { name: "Review correction", exact: true }).click();
  await page.getByRole("button", { name: "Confirm and record correction", exact: true }).click();
  await expect(page.getByText(/The result is uncertain/)).toBeVisible({ timeout: 30000 });
  expect(qa.blocked).toEqual([`POST /api/contributions/${receipt!.id}/corrections`]);
});

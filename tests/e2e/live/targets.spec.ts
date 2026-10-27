import { expect, liveEnabled, liveSkipReason, signIn, test } from "../helpers/live";

test.skip(!liveEnabled, liveSkipReason);
test.describe.configure({ timeout: 120_000 });

// Target plans cannot be deleted, so this fills a new draft without saving it: the save request is blocked.
test("allocation percentages and amounts stay in step and the quarter remainder updates", async ({ page, qa }) => {
  await signIn(page);
  await page.goto("/targets/new");
  await page.getByLabel("Annual target *").fill("1000000");
  await page.getByLabel("Q1 target").fill("400000");
  await expect(page.getByText("Q1 left to allocate: 400000.00 BDT")).toBeVisible();

  await page.getByRole("button", { name: "Add allocation", exact: true }).click();
  await page.getByLabel("Allocation 1 employee").selectOption({ index: 1 });
  await page.getByLabel("Allocation 1 vertical").selectOption({ index: 1 });
  const percentage = page.getByLabel("Allocation 1 percentage");
  const amount = page.getByLabel("Allocation 1 amount");

  await percentage.fill("25");
  await expect(amount).toHaveValue("100000.00");
  await expect(page.getByText("Q1 left to allocate: 300000.00 BDT")).toBeVisible();

  await amount.fill("50000.00");
  await expect(percentage).toHaveValue("12.5");
  await expect(page.getByText("Q1 left to allocate: 350000.00 BDT")).toBeVisible();

  // An invalid percentage is flagged and leaves the amount alone.
  await percentage.fill("150");
  await expect(page.getByRole("alert").filter({ hasText: "percentage from 0 to 100" })).toBeVisible();
  await expect(amount).toHaveValue("50000.00");

  await percentage.fill("12.5");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByText(/Save result is uncertain/)).toBeVisible({ timeout: 30000 });
  expect(qa.blocked).toContain("POST /api/targets");
});

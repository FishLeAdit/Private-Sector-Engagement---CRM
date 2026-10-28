import { expect, liveEnabled, liveSkipReason, signIn, test } from "../helpers/live";

test.skip(!liveEnabled, liveSkipReason);
test.describe.configure({ timeout: 120_000 });

// Read-only: nothing is created, so nothing needs cleaning up.
test("the overview shows both lenses and the queue, hands its period to Reports and keeps the theme", async ({
  page,
}) => {
  await signIn(page);
  await expect(page.getByRole("heading", { level: 1, name: "PSE overview" })).toBeVisible({ timeout: 30000 });
  for (const name of ["Monetary fundraising", "Non-monetary work", "Your queue and recent activity"])
    await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
  for (const name of ["My upcoming meetings", "My open activities", "Recent contributions", "Deals closing in 30 days"])
    await expect(page.getByRole("region", { name })).toBeVisible();

  // A quarter chosen here carries into Detailed reports.
  await page.getByLabel("Period").selectOption("q1");
  await page.getByRole("button", { name: "Show", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\?.*period=q1/, { timeout: 30000 });
  await page.getByRole("link", { name: "Detailed reports" }).click();
  await expect(page).toHaveURL(/\/reports\?.*period=q1/, { timeout: 30000 });
  await expect(page.getByRole("heading", { level: 1, name: "Performance reports" })).toBeVisible();
  await expect(page.getByLabel("Period")).toHaveValue("q1");

  // The theme choice survives a reload.
  await page.getByRole("button", { name: "Light theme" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "avionics-light");
  await page.getByRole("button", { name: "Dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "avionics-dark");
});

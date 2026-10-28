import { expect, liveEnabled, liveSkipReason, signIn, test } from "../helpers/live";

test.skip(!liveEnabled, liveSkipReason);
test.describe.configure({ timeout: 120_000 });

// A page number past the end redirects to the real last page with the filters kept (read-only).
test("every list redirects a page past the end to its last page", async ({ page }) => {
  await signIn(page);
  for (const [path, filter] of [
    ["/contacts", "kind=individual"],
    ["/opportunities", "currency=BDT"],
    ["/meetings", "status=scheduled"],
    ["/activities", "status=open"],
    ["/contributions", "currency=BDT"],
    ["/targets", ""],
  ]) {
    await page.goto(`${path}?${filter ? `${filter}&` : ""}page=9999`);
    await expect(page).not.toHaveURL(/page=9999/, { timeout: 30000 });
    const url = new URL(page.url());
    expect(url.pathname).toBe(path);
    expect(Number(url.searchParams.get("page"))).toBeLessThan(9999);
    if (filter) expect(url.search).toContain(filter);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/temporarily unavailable/i)).toHaveCount(0);
  }
});

// The stage board covers every matching deal, not one page of the list (read-only).
test("the stage board counts every matching deal and the list agrees", async ({ page }) => {
  await signIn(page);
  await page.goto("/opportunities");
  const listed = await page.getByText(/^Expected value of all \d+ matching deals?:/).textContent({ timeout: 30000 });
  await page.getByRole("link", { name: "Stage board", exact: true }).click();
  await expect(page).toHaveURL(/view=board/, { timeout: 30000 });
  // The same deals and totals as the list, with no pagination.
  await expect(page.getByText(listed!, { exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Opportunity pages" })).toHaveCount(0);
  const total = Number(/all (\d+) matching/.exec(listed!)![1]);
  const badges = await page.locator("section[aria-labelledby^='stage-'] h2 .badge").allTextContents();
  expect(badges.reduce((sum, n) => sum + Number(n), 0)).toBe(total);
  await expect(page.getByText(/temporarily unavailable/i)).toHaveCount(0);
});

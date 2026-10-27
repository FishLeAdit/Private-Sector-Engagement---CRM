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

import { expect, test } from "@playwright/test";

test("anonymous root opens the sign-in page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in to PSE CRM" })).toBeVisible();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
});

test("anonymous dashboard and nested routes redirect to sign-in", async ({ page }) => {
  for (const path of ["/dashboard", "/contacts/new", "/targets"]) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}$`));
    await expect(page.getByRole("heading", { name: "Sign in to PSE CRM" })).toBeVisible();
  }
});

test("anonymous CRM APIs return JSON 401", async ({ request }) => {
  for (const feature of ["contacts", "opportunities", "meetings", "activities", "targets", "contributions", "reports"]) {
    const response = await request.get(`/api/${feature}`);
    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "Sign in required" });
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
});

test("sign-in return destination cannot leave the workspace", async ({ page }) => {
  await page.goto("/login?next=https%3A%2F%2Fevil.invalid");
  await expect(page.locator('input[name="next"]')).toHaveValue("/dashboard");
});

test("PSE demo user can sign in, reload and sign out", async ({ page }) => {
  test.skip(!process.env.E2E_PSE_EMAIL || !process.env.E2E_PSE_PASSWORD, "Optional live demo credentials are not configured.");
  await page.goto("/login");
  await page.getByLabel("Email address").fill(process.env.E2E_PSE_EMAIL!);
  await page.getByLabel("Password", { exact: true }).fill(process.env.E2E_PSE_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30000 });
  await page.reload();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  expect((await page.request.get("/api/contacts")).status()).toBe(200);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?/);
});

test("restricted demo account cannot enter the PSE workspace", async ({ page }) => {
  test.skip(!process.env.E2E_RESTRICTED_EMAIL || !process.env.E2E_RESTRICTED_PASSWORD, "Optional restricted-account credentials are not configured.");
  await page.goto("/login");
  await page.getByLabel("Email address").fill(process.env.E2E_RESTRICTED_EMAIL!);
  await page.getByLabel("Password", { exact: true }).fill(process.env.E2E_RESTRICTED_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("does not have PSE access", { timeout: 30000 });
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?/);
});

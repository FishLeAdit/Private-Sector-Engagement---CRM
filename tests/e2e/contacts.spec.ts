import { expect, test } from "@playwright/test";

test("contact mutations require authentication", async ({ request }) => {
  const created = await request.post("/api/contacts", {
    data: { kind: "individual", name: "Fictional Anonymous", email: "anonymous@example.invalid" },
  });
  expect(created.status()).toBe(401);
  const edited = await request.patch("/api/contacts/10000000-0000-4000-8000-000000000001", {
    data: { notes: "Anonymous change" },
  });
  expect(edited.status()).toBe(401);
  expect((await request.delete("/api/contacts/10000000-0000-4000-8000-000000000001")).status()).toBe(401);
  expect(
    (await request.post("/api/contacts/duplicates", { data: { email: "anonymous@example.invalid" } })).status(),
  ).toBe(401);
});

test("anonymous contact details and edit routes require sign-in", async ({ page }) => {
  for (const path of [
    "/contacts/10000000-0000-4000-8000-000000000001",
    "/contacts/10000000-0000-4000-8000-000000000001/edit",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login\?/);
  }
});

test("fictional company/person can be created, linked, edited, searched, deduplicated and deleted", async ({
  page,
}) => {
  test.skip(
    process.env.E2E_CONTACT_WRITES !== "1" || !process.env.E2E_PSE_EMAIL || !process.env.E2E_PSE_PASSWORD,
    "Live contact writes require an explicit E2E_CONTACT_WRITES=1 opt-in and private demo credentials.",
  );
  const token = Date.now();
  const companyName = `E2E Fictional Company ${token}`;
  const personName = `E2E Fictional Person ${token}`;
  const personEmail = `pse-person-${token}@example.invalid`;

  await page.goto("/login");
  await page.getByLabel("Email address", { exact: true }).fill(process.env.E2E_PSE_EMAIL!);
  await page.getByLabel("Password", { exact: true }).fill(process.env.E2E_PSE_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30000 });

  await page.goto("/contacts/new");
  await page.getByLabel("Contact type").selectOption("company");
  await page.getByLabel("Company name").fill(companyName);
  await page.getByLabel("Email address").fill(`pse-company-${token}@example.invalid`);
  await page.getByRole("button", { name: "Create contact", exact: true }).click();
  await expect(page.getByRole("heading", { name: companyName, exact: true })).toBeVisible({ timeout: 30000 });
  const companyPath = new URL(page.url()).pathname;

  await page.goto("/contacts/new");
  await page.getByLabel("Contact name").fill(personName);
  await page.getByLabel("Email address").fill(personEmail);
  await page.getByRole("combobox", { name: /Company \/ workplace/ }).fill(companyName);
  await page.getByRole("button", { name: companyName, exact: true }).click();
  await page
    .getByLabel(/Relationship notes/)
    .fill("Fictional contact workflow test. https://drive.google.com/file/d/demo/view");
  await page.getByRole("button", { name: "Create contact", exact: true }).click();
  await expect(page.getByRole("heading", { name: personName, exact: true })).toBeVisible({ timeout: 30000 });
  const personPath = new URL(page.url()).pathname;
  await page.reload();
  await expect(page.getByRole("link", { name: companyName, exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Edit contact", exact: true }).click();
  await page.getByLabel("Contact name").fill(`${personName} Updated`);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("heading", { name: `${personName} Updated`, exact: true })).toBeVisible({
    timeout: 30000,
  });

  await page.goto("/contacts");
  await page.getByLabel("Search contacts").fill(`${personName} Updated`);
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByRole("link", { name: `${personName} Updated`, exact: true })).toBeVisible();

  await page.goto("/contacts/new");
  await page.getByLabel("Contact name").fill("E2E Fictional Duplicate");
  await page.getByLabel("Email address").fill(personEmail);
  await expect(page.getByText("Possible duplicate contact")).toBeVisible();
  await page.getByRole("button", { name: "Create contact", exact: true }).click();
  await expect(page.getByText("A contact with that email or phone already exists.")).toBeVisible();
  await page.goto(companyPath);
  await page.getByRole("button", { name: "Delete contact", exact: true }).click();
  await page.getByRole("button", { name: "Delete permanently", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("linked");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();

  await page.goto(personPath);
  await page.getByRole("button", { name: "Delete contact", exact: true }).click();
  await page.getByRole("button", { name: "Delete permanently", exact: true }).click();
  await expect(page).toHaveURL(/\/contacts\?deleted=1$/, { timeout: 30000 });
  expect((await page.request.get(`/api${personPath}`)).status()).toBe(404);

  await page.goto(companyPath);
  await page.getByRole("button", { name: "Delete contact", exact: true }).click();
  await page.getByRole("button", { name: "Delete permanently", exact: true }).click();
  await expect(page).toHaveURL(/\/contacts\?deleted=1$/, { timeout: 30000 });
  expect((await page.request.get(`/api${companyPath}`)).status()).toBe(404);
});

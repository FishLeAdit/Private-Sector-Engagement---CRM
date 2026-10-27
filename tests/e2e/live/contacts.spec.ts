import {
  deleteFromDetailPage,
  expect,
  heading,
  liveEnabled,
  liveSkipReason,
  qaName,
  recordPath,
  signIn,
  test,
} from "../helpers/live";

test.skip(!liveEnabled, liveSkipReason);
// About a dozen page visits; a development server compiles each page on its first visit.
test.describe.configure({ timeout: 120_000 });

test("company and person can be created, linked, edited, searched, deduplicated and deleted", async ({ page, qa }) => {
  await signIn(page);
  const token = Date.now();
  const companyName = qaName("Company");
  const personName = qaName("Person");
  const personEmail = `qa-person-${token}@example.invalid`;

  await page.goto("/contacts/new");
  await page.getByLabel("Contact type").selectOption("company");
  await page.getByLabel("Company name").fill(companyName);
  await page.getByLabel("Email address").fill(`qa-company-${token}@example.invalid`);
  await page.getByRole("button", { name: "Create contact", exact: true }).click();
  await expect(heading(page, companyName)).toBeVisible({ timeout: 30000 });
  const company = recordPath(page);
  qa.track(company);

  await page.goto("/contacts/new");
  await page.getByLabel("Contact name").fill(personName);
  await page.getByLabel("Email address").fill(personEmail);
  await page.getByRole("combobox", { name: /Company \/ workplace/ }).fill(companyName);
  await page.getByRole("button", { name: companyName, exact: true }).click();
  await page.getByLabel(/Relationship notes/).fill("QA contact workflow. https://drive.google.com/file/d/demo/view");
  await page.getByRole("button", { name: "Create contact", exact: true }).click();
  await expect(heading(page, personName)).toBeVisible({ timeout: 30000 });
  const person = recordPath(page);
  qa.track(person);
  await page.reload();
  await expect(page.getByRole("link", { name: companyName, exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Edit contact", exact: true }).click();
  await page.getByLabel("Contact name").fill(`${personName} edited`);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(heading(page, `${personName} edited`)).toBeVisible({ timeout: 30000 });

  await page.goto("/contacts");
  await page.getByLabel("Search contacts").fill(`${personName} edited`);
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByRole("link", { name: `${personName} edited`, exact: true })).toBeVisible();

  // The duplicate is warned about while typing and rejected on save, so nothing is created.
  await page.goto("/contacts/new");
  await page.getByLabel("Contact name").fill(qaName("Duplicate"));
  await page.getByLabel("Email address").fill(personEmail);
  await expect(page.getByText("Possible duplicate contact")).toBeVisible();
  await page.getByRole("button", { name: "Create contact", exact: true }).click();
  await expect(page.getByText("A contact with that email or phone already exists.")).toBeVisible();

  // The company cannot be deleted while a person works there.
  await deleteFromDetailPage(page, company, "contact");
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("linked");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();

  for (const path of [person, company]) {
    await deleteFromDetailPage(page, path, "contact");
    await expect(page).toHaveURL(/\/contacts\?deleted=1$/, { timeout: 30000 });
    expect((await page.request.get(`/api${path}`)).status()).toBe(404);
  }
});

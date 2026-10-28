import { test as base, expect, type Page } from "@playwright/test";

// Opt-in signed-in checks against the Supabase project in .env.local (the hosted demo). They create records
// named "QA …" and delete them again; anything that cannot be undone is blocked before it leaves the browser.
export const liveEnabled =
  process.env.E2E_LIVE_WRITES === "1" && !!process.env.E2E_PSE_EMAIL && !!process.env.E2E_PSE_PASSWORD;
export const liveSkipReason = "Live checks need E2E_LIVE_WRITES=1 and the demo E2E_PSE_EMAIL/E2E_PSE_PASSWORD.";

// Hosted writes the live specs must never make. Receipts and their corrections are append-only, approval locks
// a plan, and verticals, stages and categories cannot be deleted. Account changes and draft-plan deletion touch
// real sign-ins and demo data. Contacts, deals, meetings and activities can be deleted again, so they are allowed.
const permanentWrites: [method: string, path: RegExp][] = [
  ["POST", /^\/api\/accounts$/],
  ["PATCH", /^\/api\/accounts\/[^/]+$/],
  ["DELETE", /^\/api\/accounts\/[^/]+$/],
  ["POST", /^\/api\/accounts\/[^/]+\/password$/],
  ["DELETE", /^\/api\/targets\/[^/]+$/],
  ["POST", /^\/api\/contributions$/],
  ["POST", /^\/api\/contributions\/[^/]+\/corrections$/],
  ["POST", /^\/api\/targets$/],
  ["PATCH", /^\/api\/targets\/[^/]+$/],
  ["POST", /^\/api\/targets\/[^/]+\/approve$/],
  ["POST", /^\/api\/targets\/verticals$/],
  ["POST", /^\/api\/opportunities\/configuration$/],
];

type QaRecords = {
  blocked: string[]; // Permanent writes the page attempted, e.g. "POST /api/targets".
  track: (path: string) => void; // Register a created record ("/contacts/<id>") for cleanup.
};

// Every live test gets the write block and cleanup automatically. The fixture has its own time budget,
// so tracked records are still deleted after the test itself has failed or timed out.
export const test = base.extend<{ qa: QaRecords }>({
  qa: [
    async ({ page }, use) => {
      const blocked: string[] = [];
      await page.route("**/api/**", route => {
        const request = route.request();
        const path = new URL(request.url()).pathname;
        if (permanentWrites.some(([method, pattern]) => request.method() === method && pattern.test(path))) {
          blocked.push(`${request.method()} ${path}`);
          return route.abort("blockedbyclient");
        }
        return route.continue();
      });
      const paths: string[] = [];
      await use({ blocked, track: path => void paths.push(path) });
      await removeRecords(page, paths);
    },
    { auto: true, timeout: 60_000 },
  ],
});
export { expect };

// Deletes records through the API, newest first. Writes must carry a same-origin Origin header. A 404 means
// the test already deleted the record; anything else fails the test with the paths to delete by hand.
async function removeRecords(page: Page, paths: string[]) {
  const base = test.info().project.use.baseURL ?? process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100";
  const leftovers: string[] = [];
  for (const path of [...paths].reverse()) {
    try {
      const response = await page.request.delete(`/api${path}`, { headers: { origin: new URL(base).origin } });
      if (![200, 404].includes(response.status())) leftovers.push(`${path} (HTTP ${response.status()})`);
    } catch (error) {
      leftovers.push(`${path} (${(error as Error).message})`);
    }
  }
  expect(leftovers, "QA records left on the hosted project; delete them by hand").toEqual([]);
}

export async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email address", { exact: true }).fill(process.env.E2E_PSE_EMAIL!);
  await page.getByLabel("Password", { exact: true }).fill(process.env.E2E_PSE_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30000 });
}

// Unique per run, so leftovers from an interrupted run are easy to find and never collide.
export function qaName(label: string) {
  return `QA ${label} ${Date.now()}`;
}

// The record's path from the current detail page URL, e.g. "/contacts/<id>".
export function recordPath(page: Page) {
  return new URL(page.url()).pathname;
}

export function heading(page: Page, name: string) {
  return page.getByRole("heading", { level: 1, name, exact: true });
}

export async function deleteFromDetailPage(page: Page, path: string, noun: string) {
  await page.goto(path);
  await page.getByRole("button", { name: `Delete ${noun}`, exact: true }).click();
  await page.getByRole("button", { name: "Delete permanently", exact: true }).click();
}

import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  client: vi.fn(),
  reference: vi.fn(),
  importRows: vi.fn(),
  invalidate: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("../../src/lib/auth/access", () => ({ authorizeApi: mocks.authorize }));
vi.mock("../../src/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("../../src/features/odoo/queries", () => ({
  createOdooRepository: () => ({ reference: mocks.reference, importRows: mocks.importRows }),
}));
vi.mock("../../src/lib/cache/invalidation", () => ({ invalidateReportCache: mocks.invalidate }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { POST } from "../../src/app/api/settings/odoo-check/route";
import { POST as IMPORT } from "../../src/app/api/settings/odoo-import/route";

const manager = "00000000-0000-4000-8000-000000000001";
let role: string;
const sample = (file: string, set = "mixed") => readFileSync(`public/odoo-templates/${set}/odoo-${file}.csv`, "utf8");
const ready = () => Object.fromEntries(["contacts", "deals", "activities"].map(file => [file, sample(file, "ready")]));
beforeEach(() => {
  vi.clearAllMocks();
  role = "pse_manager";
  mocks.authorize.mockImplementation(async ({ manager: needsManager = false } = {}) =>
    needsManager && role === "pse_member"
      ? { ok: false, response: NextResponse.json({ error: "Denied" }, { status: 403 }) }
      : {
          ok: true,
          access: {
            status: "allowed",
            userId: manager,
            profile: { id: manager, display_name: "Fictional Manager", department: "PSE", role, active: true },
          },
        },
  );
  mocks.reference.mockResolvedValue({
    contacts: [
      { name: "Existing Fictional Donor", email_normalized: "csr@fictional-textiles.example", phone_normalized: null },
    ],
    owners: ["JAC", "Tanvir Hasan", "Nusrat Jahan", "Arif Chowdhury", "Sadia Islam"].map((name, i) => ({
      id: `o${i}`,
      display_name: name,
      active: true,
    })),
    stages: ["New", "Scoping", "Preparation"].map(name => ({ id: name, name, active: true })),
    categories: [
      { id: "c1", code: "DSP", name: "Digital School Program", active: true },
      { id: "c2", code: "SAC", name: "Sponsor a Child", active: true },
      { id: "c3", code: "EVENT_CAMPAIGN", name: "Event & Campaign", active: true },
    ],
    imported: { contacts: [], deals: [], activities: [] },
  });
});
const post = (body: unknown, origin = "http://localhost") =>
  new Request("http://localhost/api/settings/odoo-check", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("Odoo import check API", () => {
  it("checks the files against the caller's project data and returns the report", async () => {
    const response = await POST(post({ contacts: sample("contacts"), deals: sample("deals") }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const { report } = await response.json();
    expect(report.files.contacts.rows).toBe(5);
    expect(report.files.activities.rows).toBe(0);
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        line: 2,
        message: 'email: matches the existing CRM contact "Existing Fictional Donor".',
      }),
    );
    expect(report.findings).toContainEqual(
      expect.objectContaining({ file: "deals", message: expect.stringMatching(/^stage: "Submitted"/) }),
    );
  });
  it("is for managers only and rejects cross-origin requests", async () => {
    role = "pse_member";
    expect((await POST(post({ contacts: "a" }))).status).toBe(403);
    role = "pse_manager";
    expect((await POST(post({ contacts: sample("contacts") }, "https://evil.example"))).status).toBe(403);
    expect(mocks.reference).not.toHaveBeenCalled();
  });
  it("asks for a file, refuses unknown fields and names a file it cannot read", async () => {
    expect((await POST(post({ contacts: " " }))).status).toBe(422);
    expect((await POST(post({ contacts: "a", leads: "b" }))).status).toBe(422);
    const broken = await POST(post({ deals: 'odoo_id\n"never closed' }));
    expect(broken.status).toBe(422);
    expect((await broken.json()).error).toMatch(/^Deals file: A quoted value starting on line 2/);
    expect(mocks.reference).not.toHaveBeenCalled();
  });
});

describe("Odoo import API", () => {
  it("imports files that need no review in one batch and expires the affected pages", async () => {
    mocks.reference.mockResolvedValueOnce({
      ...(await mocks.reference()),
      stages: ["New", "Scoping", "Preparation", "Submitted"].map(name => ({ id: name, name, active: true })),
    });
    const response = await IMPORT(post(ready()));
    expect(response.status).toBe(201);
    const { result } = await response.json();
    expect([result.contacts.length, result.deals.length, result.activities.length]).toEqual([5, 4, 5]);
    const rows = mocks.importRows.mock.calls[0][0];
    expect(rows.deals.find((d: { odoo_id: string }) => d.odoo_id === "crm_lead_401").owner_id).toBe("o0");
    expect(mocks.invalidate).toHaveBeenCalled();
    expect(mocks.revalidate).toHaveBeenCalledWith("/contacts", "layout");
  });
  it("refuses files that need review, and members", async () => {
    // Without "Submitted" configured, one ready deal needs review, so nothing is imported.
    expect((await IMPORT(post(ready()))).status).toBe(422);
    expect((await IMPORT(post({ contacts: sample("contacts") }))).status).toBe(422);
    role = "pse_member";
    expect((await IMPORT(post(ready()))).status).toBe(403);
    expect(mocks.importRows).not.toHaveBeenCalled();
  });
});

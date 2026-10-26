import { describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/types/database.types";
vi.mock("server-only", () => ({}));
import { createContactRepository, quotedContains } from "../../src/features/contacts/queries";
import { contactListSchema } from "../../src/features/contacts/schemas";

function repository(body: unknown = [], status = 200) {
  const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Content-Range": "0-0/0" } }));
  const client = createClient<Database>("https://example.supabase.co", "sb_publishable_fictional", { global: { fetch: fetcher }, auth: { persistSession: false, autoRefreshToken: false } });
  return { repo: createContactRepository(client), fetcher };
}

describe("Supabase contact query contracts", () => {
  it("uses bounded deterministic pagination and company/type filters", async () => {
    const { repo, fetcher } = repository();
    await repo.list(contactListSchema.parse({ kind: "individual", page: 2, company_id: "10000000-0000-4000-8000-000000000001" }));
    const url = new URL(fetcher.mock.calls[0][0]);
    expect(url.searchParams.get("offset")).toBe("20");
    expect(url.searchParams.get("limit")).toBe("20");
    expect(url.searchParams.get("kind")).toBe("eq.individual");
    expect(url.searchParams.get("company_id")).toContain("10000000");
    expect(url.searchParams.get("order")).toBe("name.asc,id.asc");
    expect(url.searchParams.get("select")).toContain("company:company_id(id,name)");
  });
  it("quotes raw filter values and escapes literal LIKE wildcards", async () => {
    const search = 'Example, "Quoted"_%\\name';
    const { repo, fetcher } = repository();
    await repo.list(contactListSchema.parse({ q: search }));
    const filter = new URL(fetcher.mock.calls[0][0]).searchParams.get("or");
    expect(filter).toContain(`name.ilike.${quotedContains(search)}`);
    expect(quotedContains(search)).toContain('\\"Quoted\\"');
    expect(quotedContains(search)).toContain('\\\\_');
    expect(quotedContains(search)).toContain('\\\\%');
    expect(contactListSchema.safeParse({ q: "*" }).success).toBe(false);
  });
  it("adds normalized phone search only when digits are supplied", async () => {
    const { repo, fetcher } = repository();
    await repo.list(contactListSchema.parse({ q: "+880 (1700)" }));
    expect(new URL(fetcher.mock.calls[0][0]).searchParams.get("or")).toContain('phone_normalized.ilike."%8801700%"');
    await repo.list(contactListSchema.parse({ q: "+" }));
    expect(new URL(fetcher.mock.calls[1][0]).searchParams.get("or")).not.toContain("phone_normalized");
  });
  it("handles the database uniqueness race without returning contact values", async () => {
    const { repo } = repository({ code: "23505", message: 'duplicate key violates unique constraint "contacts_email_unique"', details: "Sensitive email value" }, 409);
    const error = await repo.create({ kind: "individual", name: "Fictional", email: "fictional@example.invalid" }, "00000000-0000-4000-8000-000000000002").catch(error => error);
    expect(error).toMatchObject({ status: 409, fields: { email: expect.any(Array) } });
    expect(JSON.stringify(error)).not.toContain("Sensitive");
  });
  it("maps permission and provider failures to safe application errors", async () => {
    await expect(repository({ code: "42501", message: "Policy internals" }, 403).repo.find("00000000-0000-4000-8000-000000000001")).rejects.toMatchObject({ status: 403 });
    await expect(repository({ code: "XX000", message: "Database internals" }, 500).repo.find("00000000-0000-4000-8000-000000000001")).rejects.toMatchObject({ status: 503 });
  });
  it("deletes only the requested ID and checks the affected row", async () => {
    const id = "10000000-0000-4000-8000-000000000099";
    const { repo, fetcher } = repository({ id });
    expect(await repo.remove(id)).toBe(true);
    const url = new URL(fetcher.mock.calls[0][0]);
    expect(url.searchParams.get("id")).toBe(`eq.${id}`);
    expect(url.searchParams.get("select")).toBe("id");
    expect(fetcher.mock.calls[0][1].method).toBe("DELETE");
    expect(await repository(null).repo.remove(id)).toBe(false);
  });
  it.each(["23503", "23001"])("maps delete reference conflict %s to a safe 409", async code => {
    await expect(repository({ code, message: "Foreign key internals", details: "Sensitive record details" }, 409).repo.remove("10000000-0000-4000-8000-000000000099"))
      .rejects.toMatchObject({ status: 409, message: expect.stringContaining("linked") });
  });
});

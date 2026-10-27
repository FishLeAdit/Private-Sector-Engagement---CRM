import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import type { ContactRecord } from "../../src/features/contacts/types";
import { ContactError } from "../../src/features/contacts/types";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  createClient: vi.fn(),
  repository: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("../../src/lib/auth/access", () => ({ authorizeApi: mocks.authorize }));
vi.mock("../../src/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("../../src/features/contacts/queries", () => ({ createContactRepository: mocks.repository }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));

import { GET, POST } from "../../src/app/api/contacts/route";
import { GET as GET_ONE, PATCH, DELETE } from "../../src/app/api/contacts/[id]/route";
import { POST as DUPLICATES } from "../../src/app/api/contacts/duplicates/route";

const id = "10000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000002";
const record = {
  id,
  kind: "individual",
  name: "Fictional API Contact",
  email: "api@example.invalid",
  phone: null,
  company_id: null,
  designation: null,
  website: null,
  industry: null,
  notes: null,
  created_by: userId,
} as ContactRecord;
let repo: {
  find: ReturnType<typeof vi.fn>;
  list: ReturnType<typeof vi.fn>;
  duplicates: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  history: ReturnType<typeof vi.fn>;
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.authorize.mockResolvedValue({
    ok: true,
    access: {
      status: "allowed",
      userId,
      profile: { id: userId, display_name: "Fictional User", active: true, department: "PSE", role: "pse_member" },
    },
  });
  repo = {
    find: vi.fn().mockResolvedValue(record),
    list: vi.fn().mockResolvedValue({ contacts: [record], count: 1 }),
    duplicates: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue(record),
    update: vi.fn().mockResolvedValue(record),
    remove: vi.fn().mockResolvedValue(true),
    history: vi.fn(),
  };
  mocks.repository.mockReturnValue(repo);
});

function request(method: string, data: unknown, origin = "http://localhost") {
  return new Request("http://localhost/api/contacts", {
    method,
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(data),
  });
}

describe("Contacts HTTP API", () => {
  it("returns a paginated authorized list with no-store headers", async () => {
    const response = await GET(new Request("http://localhost/api/contacts?kind=company&page=2"));
    expect(response.status).toBe(200);
    expect(repo.list).toHaveBeenCalledWith({ kind: "company", page: 2, q: "", company_id: "" });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("does not touch data when request authorization fails", async () => {
    mocks.authorize.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Sign in required" }, { status: 401 }),
    });
    expect((await POST(request("POST", {}))).status).toBe(401);
    expect((await DELETE(request("DELETE", {}), { params: Promise.resolve({ id }) })).status).toBe(401);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it("rejects cross-origin and missing-origin cookie mutations", async () => {
    expect((await POST(request("POST", {}, "https://evil.invalid"))).status).toBe(403);
    const absent = request("POST", {});
    absent.headers.delete("origin");
    expect((await POST(absent)).status).toBe(403);
    expect(repo.create).not.toHaveBeenCalled();
  });
  it("creates through the shared service using the verified creator identity", async () => {
    const response = await POST(
      request("POST", { kind: "individual", name: " Fictional API Contact ", email: " API@EXAMPLE.INVALID " }),
    );
    expect(response.status).toBe(201);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Fictional API Contact", email: "api@example.invalid" }),
      userId,
    );
    expect(mocks.revalidate).toHaveBeenCalledWith("/contacts");
  });
  it("rejects mass assignment and incomplete contact details", async () => {
    expect((await POST(request("POST", { kind: "individual", name: "No communication" }))).status).toBe(422);
    expect(
      (
        await POST(
          request("POST", { kind: "individual", name: "Spoof", email: "spoof@example.invalid", created_by: id }),
        )
      ).status,
    ).toBe(422);
    expect(repo.create).not.toHaveBeenCalled();
  });
  it("returns duplicate conflicts with existing record links", async () => {
    repo.duplicates.mockResolvedValue([
      { id, name: "Fictional Existing", email_normalized: "api@example.invalid", phone_normalized: null },
    ]);
    const response = await POST(
      request("POST", { kind: "individual", name: "Duplicate", email: "api@example.invalid" }),
    );
    expect(response.status).toBe(409);
    expect((await response.json()).duplicates[0].id).toBe(id);
    expect(repo.create).not.toHaveBeenCalled();
  });
  it("validates malformed JSON, content type and request size", async () => {
    const invalid = new Request("http://localhost/api/contacts", {
      method: "POST",
      headers: { Origin: "http://localhost", "Content-Type": "application/json" },
      body: "{",
    });
    expect((await POST(invalid)).status).toBe(400);
    const plain = request("POST", {});
    plain.headers.set("Content-Type", "text/plain");
    expect((await POST(plain)).status).toBe(415);
    expect((await POST(request("POST", { notes: "x".repeat(65537) }))).status).toBe(413);
  });
  it("returns a detail record or 404 without leaking database errors", async () => {
    expect(
      (await GET_ONE(new Request(`http://localhost/api/contacts/${id}`), { params: Promise.resolve({ id }) })).status,
    ).toBe(200);
    repo.find.mockResolvedValueOnce(null);
    expect(
      (await GET_ONE(new Request(`http://localhost/api/contacts/${id}`), { params: Promise.resolve({ id }) })).status,
    ).toBe(404);
  });
  it("allows partial updates but denies updates to a colleague's contact", async () => {
    expect((await PATCH(request("PATCH", { notes: "Updated" }), { params: Promise.resolve({ id }) })).status).toBe(200);
    repo.find.mockResolvedValueOnce({ ...record, created_by: "00000000-0000-4000-8000-000000000003" });
    expect((await PATCH(request("PATCH", { notes: "Forbidden" }), { params: Promise.resolve({ id }) })).status).toBe(
      403,
    );
  });
  it("normalizes the authenticated duplicate-check payload", async () => {
    expect(
      (await DUPLICATES(request("POST", { email: " API@EXAMPLE.INVALID ", phone: "+880 (1700) 009999", exclude: id })))
        .status,
    ).toBe(200);
    expect(repo.duplicates).toHaveBeenCalledWith("api@example.invalid", "8801700009999", id);
  });
  it("deletes one authorized record and invalidates its list/detail paths", async () => {
    const response = await DELETE(request("DELETE", {}), { params: Promise.resolve({ id }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true, id });
    expect(repo.remove).toHaveBeenCalledWith(id);
    expect(mocks.revalidate).toHaveBeenCalledWith("/contacts");
    expect(mocks.revalidate).toHaveBeenCalledWith(`/contacts/${id}`);
  });
  it("requires same-origin requests for deletion", async () => {
    expect(
      (await DELETE(request("DELETE", {}, "https://evil.invalid"), { params: Promise.resolve({ id }) })).status,
    ).toBe(403);
    expect(repo.remove).not.toHaveBeenCalled();
  });
  it("denies deleting a colleague's record or a stale-permission record", async () => {
    repo.find.mockResolvedValueOnce({ ...record, created_by: "00000000-0000-4000-8000-000000000003" });
    expect((await DELETE(request("DELETE", {}), { params: Promise.resolve({ id }) })).status).toBe(403);
    expect(repo.remove).not.toHaveBeenCalled();
    repo.remove.mockResolvedValueOnce(false);
    expect((await DELETE(request("DELETE", {}), { params: Promise.resolve({ id }) })).status).toBe(403);
  });
  it("returns 409 when the database blocks deletion of a linked contact", async () => {
    repo.remove.mockRejectedValueOnce(new ContactError(409, "This contact is linked to other records."));
    const response = await DELETE(request("DELETE", {}), { params: Promise.resolve({ id }) });
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("linked");
  });
});

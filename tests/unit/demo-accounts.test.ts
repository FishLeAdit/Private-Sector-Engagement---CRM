import { describe, expect, it } from "vitest";
import { planAccounts } from "../../scripts/lib/demo-accounts";

const profile = (id: string, display_name: string, role = "pse_member", department = "PSE") => ({
  id,
  display_name,
  role,
  department,
  active: true,
});
const emails = new Map([
  ["a", "owner@fictional.example"],
  ["b", "manager@fictional.example"],
  ["c", "member@fictional.example"],
  ["d", "hr@fictional.example"],
]);
const generic = [
  profile("a", "Demo Manager", "pse_manager"),
  profile("b", "Demo Manager", "pse_manager"),
  profile("c", "Demo Member"),
  profile("d", "Demo Member", "pse_member", "HR"),
];

describe("named demo accounts", () => {
  it("promotes the superadmin, renames the generic PSE profiles and creates the rest", () => {
    expect(planAccounts(generic, emails, "OWNER@fictional.example")).toEqual([
      { kind: "promote", id: "a", email: "OWNER@fictional.example", rename: true },
      { kind: "adopt", id: "b", from: "Demo Manager", name: "JAC", role: "pse_manager" },
      { kind: "create", email: "tanvir.hasan@example.com", name: "Tanvir Hasan", role: "pse_manager" },
      { kind: "adopt", id: "c", from: "Demo Member", name: "Nusrat Jahan", role: "pse_member" },
      { kind: "create", email: "arif.chowdhury@example.com", name: "Arif Chowdhury", role: "pse_member" },
      { kind: "create", email: "sadia.islam@example.com", name: "Sadia Islam", role: "pse_member" },
    ]);
  });
  it("changes nothing once the named profiles exist, and never adopts another department's profile", () => {
    const done = [
      profile("a", "PSE Superadmin", "admin"),
      ...["JAC", "Tanvir Hasan", "Nusrat Jahan", "Arif Chowdhury", "Sadia Islam"].map((name, i) =>
        profile(`n${i}`, name),
      ),
      profile("d", "Demo Member", "pse_member", "HR"),
    ];
    expect(planAccounts(done, emails, "owner@fictional.example").every(step => step.kind === "keep")).toBe(true);
    expect(planAccounts([generic[3]], emails).filter(step => step.kind === "adopt")).toEqual([]);
  });
  it("stops on an unknown superadmin email or a named sign-in that lost its profile", () => {
    expect(() => planAccounts(generic, emails, "nobody@fictional.example")).toThrow(/No profile/);
    expect(() => planAccounts([], new Map([["x", "sadia.islam@example.com"]]))).toThrow(/fix it by hand/);
  });
});

// Fictional named PSE staff for the hosted demo: two managers and three members, so owners and focal people
// are not all "Demo Manager". The example.com addresses never receive mail.
export const demoAccounts = [
  // Named "Farzana Rahman" at first; the user renamed this manager "JAC" on 28 October 2026.
  { email: "jac@example.com", display_name: "JAC", role: "pse_manager" },
  { email: "tanvir.hasan@example.com", display_name: "Tanvir Hasan", role: "pse_manager" },
  { email: "nusrat.jahan@example.com", display_name: "Nusrat Jahan", role: "pse_member" },
  { email: "arif.chowdhury@example.com", display_name: "Arif Chowdhury", role: "pse_member" },
  { email: "sadia.islam@example.com", display_name: "Sadia Islam", role: "pse_member" },
] as const;
export const SUPERADMIN_NAME = "PSE Superadmin";
// The earlier generic demo profiles. A named account takes one over (keeping its sign-in and records) before a
// new sign-in is created.
const genericNames: Record<string, string> = { pse_manager: "Demo Manager", pse_member: "Demo Member" };

type Profile = { id: string; display_name: string; department: string; role: string; active: boolean };
export type AccountStep =
  | { kind: "promote"; id: string; email: string; rename: boolean }
  | { kind: "keep"; name: string }
  | { kind: "adopt"; id: string; from: string; name: string; role: string }
  | { kind: "create"; email: string; name: string; role: string };

// What the seed would do, in order, given the project's profiles and sign-in emails. Pure, so it is testable.
export function planAccounts(profiles: Profile[], emails: Map<string, string>, superadminEmail?: string) {
  const steps: AccountStep[] = [];
  const taken = new Set<string>();
  const superadmin = superadminEmail
    ? profiles.find(p => emails.get(p.id)?.toLowerCase() === superadminEmail.toLowerCase())
    : undefined;
  if (superadminEmail && !superadmin) throw new Error(`No profile has the sign-in email ${superadminEmail}.`);
  if (superadmin) {
    taken.add(superadmin.id);
    if (superadmin.role !== "admin" || Object.values(genericNames).includes(superadmin.display_name))
      steps.push({
        kind: "promote",
        id: superadmin.id,
        email: superadminEmail!,
        rename: Object.values(genericNames).includes(superadmin.display_name),
      });
  }
  for (const account of demoAccounts) {
    if (profiles.some(p => p.display_name === account.display_name)) {
      steps.push({ kind: "keep", name: account.display_name });
      continue;
    }
    const generic = profiles.find(
      p => p.department === "PSE" && p.display_name === genericNames[account.role] && !taken.has(p.id),
    );
    if (generic) {
      taken.add(generic.id);
      steps.push({
        kind: "adopt",
        id: generic.id,
        from: generic.display_name,
        name: account.display_name,
        role: account.role,
      });
    } else if ([...emails.values()].some(email => email.toLowerCase() === account.email))
      throw new Error(
        `${account.email} has a sign-in account but no "${account.display_name}" profile; fix it by hand.`,
      );
    else steps.push({ kind: "create", email: account.email, name: account.display_name, role: account.role });
  }
  return steps;
}

import type { Tables, TablesInsert } from "../../src/types/database.types";
import { contactSchema, normalizeEmail, normalizePhone } from "../../src/features/contacts/schemas";
import { opportunitySchema } from "../../src/features/opportunities/schemas";
import { provisionalCategories, provisionalStages } from "../../src/features/opportunities/defaults";

export const DEMO_MARKER = "Fictional demo data (pse-crm-demo-v1)";
const identifier = (prefix: string, index: number) => `${prefix}-0000-4000-8000-${String(index).padStart(12, "0")}`;
export const demoContactIds = Array.from({ length: 11 }, (_, index) => identifier("d1000000", index + 1));
export const demoOpportunityIds = Array.from({ length: 8 }, (_, index) => identifier("d2000000", index + 1));
type Stage = Pick<Tables<"pipeline_stages">, "id" | "name" | "position" | "active" | "outcome">;
type Category = Pick<Tables<"contribution_categories">, "id" | "code" | "active">;
export type DemoProfile = Pick<Tables<"profiles">, "id" | "display_name" | "active" | "department" | "role">;

export function chooseDemoOwner(profiles: DemoProfile[], requested?: string) {
  const eligible = profiles.filter(
    row => row.active && row.department === "PSE" && ["pse_member", "pse_manager", "admin"].includes(row.role),
  );
  const owner = requested
    ? eligible.find(row => row.id === requested)
    : (eligible.find(row => ["pse_manager", "admin"].includes(row.role)) ?? eligible[0]);
  if (!owner)
    throw new Error("An existing active PSE profile is required. No accounts or roles will be created by this seed.");
  return owner;
}
export function demoLookupRows() {
  return {
    stages: provisionalStages.map((name, index) => {
      const outcome = ({ Won: "won", Lost: "lost", Abandoned: "abandoned" } as Record<string, string>)[name] ?? null;
      return {
        id: identifier("d3100000", index + 1),
        name,
        position: index,
        active: true,
        is_provisional: true,
        is_closed: outcome !== null,
        outcome,
      };
    }),
    categories: provisionalCategories.map(([code, name], index) => ({
      id: identifier("d3200000", index + 1),
      code,
      name,
      active: true,
      is_provisional: true,
    })),
  };
}

export function buildDemoData(
  ownerId: string,
  configuredStages: Stage[],
  configuredCategories: Category[],
  today = new Date(),
) {
  const stages = configuredStages.filter(row => row.active).sort((a, b) => a.position - b.position);
  const categories = configuredCategories.filter(row => row.active);
  if (!stages.length || !categories.length)
    throw new Error(
      "At least one active stage and category are required. Activate existing configuration in Settings.",
    );
  const date = (offset: number) =>
    new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + offset))
      .toISOString()
      .slice(0, 10);
  const contacts: TablesInsert<"contacts">[] = [];
  const addContact = (index: number, values: Omit<TablesInsert<"contacts">, "id" | "created_by">) => {
    contacts.push({
      id: demoContactIds[index - 1],
      created_by: ownerId,
      notes: `${DEMO_MARKER}. Names, websites and communication details are examples only.`,
      ...values,
    });
  };
  const email = (slug: string) => `pse-demo-${slug}@example.invalid`;
  // NANPA reserves 555-0100..0199 for fictitious, non-working numbers:
  // https://nanpa.com/numbering/555-line-numbers
  const phone = (index: number) => `+1 202 555 ${String(100 + index).padStart(4, "0")}`;
  addContact(1, {
    kind: "company",
    name: "Demo | Shapla Textiles",
    email: email("shapla"),
    phone: phone(1),
    website: "https://shapla.example.invalid",
    industry: "Textiles",
  });
  addContact(2, {
    kind: "company",
    name: "Demo | Horizon Technology",
    email: email("horizon"),
    phone: phone(2),
    website: "https://horizon.example.invalid",
    industry: "Technology",
  });
  addContact(3, {
    kind: "company",
    name: "Demo | Greenfield Foods",
    email: email("greenfield"),
    phone: phone(3),
    website: "https://greenfield.example.invalid",
    industry: "Food and agriculture",
  });
  const employees = [
    ["Nadia Rahman", "nadia", 0, "CSR lead"],
    ["Farhan Ali", "farhan", 0, "Finance contact"],
    ["Ayesha Karim", "ayesha", 1, "Partnerships lead"],
    ["Imran Chowdhury", "imran", 1, "Operations contact"],
    ["Rafiq Hasan", "rafiq", 2, "CSR director"],
    ["Samira Islam", "samira", 2, "Program contact"],
  ] as const;
  employees.forEach(([name, slug, company, designation], index) =>
    addContact(index + 4, {
      kind: "individual",
      name: `Demo | ${name}`,
      email: email(slug),
      phone: phone(index + 4),
      company_id: demoContactIds[company],
      designation,
    }),
  );
  addContact(10, { kind: "individual", name: "Demo | Independent donor A", email: email("donor-a") });
  addContact(11, { kind: "individual", name: "Demo | Independent donor B", phone: phone(11) });
  const specifications = [
    {
      name: "School sponsorship",
      company: 1,
      primary: 4,
      secondary: 5,
      stage: "New",
      category: "DSP",
      amount: 250000,
      budget: 12000,
      days: 30,
    },
    {
      name: "Digital learning partnership",
      company: 2,
      primary: 6,
      secondary: 7,
      stage: "Scoping",
      category: "PROJECT",
      amount: 180000,
      budget: 5000,
      days: 45,
    },
    {
      name: "Learning equipment donation",
      company: 2,
      primary: 6,
      secondary: 7,
      stage: "Preparation",
      category: "PROJECT",
      amount: 80000,
      days: 21,
      inKind: true,
    },
    {
      name: "Education campaign support",
      company: 3,
      primary: 8,
      secondary: 9,
      stage: "Submitted",
      category: "EVENT_CAMPAIGN",
      amount: 150000,
      budget: 15000,
      days: 28,
    },
    { name: "Child sponsorship pledge", person: 10, stage: "Pending", category: "SAC", amount: 60000, days: 14 },
    {
      name: "Community classroom sponsorship",
      company: 1,
      primary: 4,
      secondary: 5,
      // No receipts are seeded on this deal, so it can be the closed, not-won Lost example.
      stage: "Lost",
      category: "DSP",
      amount: 400000,
      budget: 10000,
      days: -7,
    },
    {
      // Won with a partial USD receipt from the finance seed. Deals that receive seeded receipts must be open
      // or won, because closed deals that were not won refuse new receipts (migration 0012).
      name: "Overseas education grant",
      person: 11,
      stage: "Won",
      category: "GENERAL",
      amount: 5000,
      days: -14,
      currency: "USD",
    },
    {
      name: "Relief partnership",
      company: 3,
      primary: 8,
      secondary: 9,
      stage: "Abandoned",
      category: "DISASTER",
      amount: 120000,
      days: -21,
    },
  ];
  const opportunities: TablesInsert<"opportunities">[] = specifications.map((deal, index) => {
    const desiredOutcome =
      ({ Won: "won", Lost: "lost", Abandoned: "abandoned" } as Record<string, string>)[deal.stage] ?? null;
    const stage =
      stages.find(row => row.name.toLowerCase() === deal.stage.toLowerCase()) ??
      stages.find(row => row.outcome === desiredOutcome && desiredOutcome !== null) ??
      stages.filter(row => row.outcome === null)[
        index % Math.max(1, stages.filter(row => row.outcome === null).length)
      ] ??
      stages[index % stages.length];
    return {
      id: demoOpportunityIds[index],
      created_by: ownerId,
      owner_id: ownerId,
      deal_name: `Demo | ${deal.name}`,
      contact_id: demoContactIds[(deal.company ?? deal.person ?? 1) - 1],
      ...(deal.primary ? { primary_contact_id: demoContactIds[deal.primary - 1] } : {}),
      ...(deal.secondary ? { secondary_contact_id: demoContactIds[deal.secondary - 1] } : {}),
      stage_id: stage.id,
      contribution_category_id: (categories.find(row => row.code === deal.category) ?? categories[0]).id,
      contribution_type: deal.inKind ? "valued_in_kind" : "cash",
      expected_amount: deal.amount,
      currency: deal.currency ?? "BDT",
      ...(deal.budget !== undefined ? { operational_budget: deal.budget } : {}),
      expected_close_at: date(deal.days),
      payment_interval: deal.person === 10 ? "monthly" : "once",
      country: "Bangladesh",
      description: `${DEMO_MARKER}. Sample financial opportunity for browsing, editing and stage-move testing.`,
      notes: `${DEMO_MARKER}. Expected value is forecast; no received contribution is recorded, including for a Won stage.`,
      ...(deal.inKind
        ? {
            valuation_note:
              "Fictional operational-team inventory and market estimate: PSE agreed an expected equipment value of BDT 80,000. This is demonstration context, not a received contribution.",
          }
        : {}),
    };
  });
  for (const row of contacts) {
    const values = { ...row };
    delete values.id;
    delete values.created_by;
    contactSchema.parse(values);
  }
  for (const row of opportunities) {
    const values = { ...row };
    delete values.id;
    delete values.created_by;
    opportunitySchema.parse(values);
  }
  return {
    companies: contacts.filter(row => row.kind === "company"),
    people: contacts.filter(row => row.kind === "individual"),
    opportunities,
  };
}

export function checkDemoContacts(
  rows: TablesInsert<"contacts">[],
  existing: Pick<Tables<"contacts">, "id" | "email_normalized" | "phone_normalized">[],
) {
  for (const row of rows) {
    const email = normalizeEmail(row.email),
      phone = normalizePhone(row.phone);
    if (
      existing.some(
        contact =>
          contact.id !== row.id &&
          ((email && contact.email_normalized === email) || (phone && contact.phone_normalized === phone)),
      )
    ) {
      throw new Error(
        "A demo email or phone is already used by a different contact. No records were changed; review existing demo contacts first.",
      );
    }
  }
}

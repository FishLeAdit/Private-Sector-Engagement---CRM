import type { CheckedRows } from "./dry-run";

// The rows `import_odoo` inserts, built from a check that found nothing to review. New records get their IDs
// here so links between them (a person's company, a deal's party, an activity's deal) can be set before insert.
export function importRows(checked: CheckedRows, newId: () => string = () => crypto.randomUUID()) {
  const contactIds = new Map(checked.contacts.map(c => [c.row.values.odoo_id, newId()]));
  const dealIds = new Map(checked.deals.map(d => [d.row.values.odoo_id, newId()]));
  const blank = (value: string) => value || null;
  const contacts = checked.contacts.map(({ row, data, parent }) => {
    const { phone, mobile } = row.values;
    // The CRM keeps one phone per contact; a second number goes into the notes rather than being lost.
    const extra = phone && mobile && phone !== mobile ? `Mobile: ${mobile}` : "";
    return {
      id: contactIds.get(row.values.odoo_id)!,
      kind: data.kind,
      name: data.name,
      email: blank(data.email),
      phone: blank(data.phone),
      company_id: parent ? contactIds.get(parent)! : null,
      designation: blank(data.designation),
      website: blank(data.website),
      industry: blank(data.industry),
      notes: blank([data.notes, extra].filter(Boolean).join("\n")),
      odoo_id: row.values.odoo_id,
    };
  });
  const deals = checked.deals.map(({ row, data, owner, stage, category }) => ({
    id: dealIds.get(row.values.odoo_id)!,
    deal_name: data.deal_name,
    contact_id: contactIds.get(row.values.partner_odoo_id)!,
    primary_contact_id: row.values.contact_odoo_id ? contactIds.get(row.values.contact_odoo_id)! : null,
    owner_id: owner!.id,
    stage_id: stage!.id,
    contribution_type: data.contribution_type,
    contribution_category_id: category!.id,
    expected_amount: data.expected_amount,
    currency: data.currency,
    expected_close_at: blank(data.expected_close_at),
    country: blank(data.country),
    description: blank(data.description),
    valuation_note: blank(data.valuation_note),
    odoo_id: row.values.odoo_id,
  }));
  const activities = checked.activities.map(({ row, data, owner }) => ({
    id: newId(),
    activity_type: data.activity_type,
    work_category: data.work_category,
    status: data.status,
    owner_id: owner!.id,
    contact_id: row.values.partner_odoo_id ? contactIds.get(row.values.partner_odoo_id)! : null,
    opportunity_id: row.values.deal_odoo_id ? dealIds.get(row.values.deal_odoo_id)! : null,
    related_person_name: blank(data.related_person_name),
    related_organization_name: blank(data.related_organization_name),
    remaining_work: blank(data.remaining_work),
    occurred_at: blank(data.occurred_at),
    notes: data.notes,
    odoo_id: row.values.odoo_id,
  }));
  return { contacts, deals, activities };
}
export type ImportRows = ReturnType<typeof importRows>;

// The Odoo export columns the import check expects, and how their values map to CRM fields. All of it is a
// proposal awaiting PSE's field mapping (docs/08-migration-plan.md).
export const columns = {
  contacts: [
    "odoo_id",
    "is_company",
    "name",
    "parent_odoo_id",
    "function",
    "email",
    "phone",
    "mobile",
    "website",
    "industry",
    "comment",
  ],
  deals: [
    "odoo_id",
    "name",
    "partner_odoo_id",
    "contact_odoo_id",
    "salesperson",
    "stage",
    "tag",
    "contribution_type",
    "expected_revenue",
    "currency",
    "date_deadline",
    "country",
    "description",
    "valuation_note",
  ],
  activities: [
    "odoo_id",
    "activity_type",
    "work_category",
    "status",
    "date",
    "assigned_to",
    "partner_odoo_id",
    "deal_odoo_id",
    "related_person",
    "related_organization",
    "summary",
    "note",
    "remaining_work",
  ],
} as const;
export type FileKey = keyof typeof columns;
export const fileLabels: Record<FileKey, string> = { contacts: "Contacts", deals: "Deals", activities: "Activities" };
// The Odoo model each file is exported from.
export const fileModels: Record<FileKey, string> = {
  contacts: "res.partner",
  deals: "crm.lead",
  activities: "mail.activity",
};

// CRM field → the template column it comes from, so schema messages name the column to fix.
export const sourceColumn: Record<string, string> = {
  kind: "is_company",
  designation: "function",
  notes: "comment / summary / note",
  company_id: "parent_odoo_id",
  deal_name: "name",
  contact_id: "partner_odoo_id",
  primary_contact_id: "contact_odoo_id",
  owner_id: "salesperson / assigned_to",
  stage_id: "stage",
  contribution_category_id: "tag",
  expected_amount: "expected_revenue",
  expected_close_at: "date_deadline",
  occurred_at: "date",
  related_person_name: "related_person",
  related_organization_name: "related_organization",
};
// Provisional value mappings from Odoo's defaults; PSE confirms these with the field mapping.
export const typeAliases: Record<string, string> = { "to do": "task", todo: "task", "upload document": "task" };
export const statusAliases: Record<string, string> = { planned: "open", today: "open", overdue: "open" };
// Placeholder IDs stand in for records an import would create, so the schemas check every other field.
export const pending = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

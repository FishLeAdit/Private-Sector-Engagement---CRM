import "server-only";
import { z } from "zod";
import type { AccessResult } from "@/lib/auth/session";
import { isActivePseProfile, isPseManager } from "@/lib/auth/roles";
import { configurationSchema, opportunityListSchema, opportunityPatchSchema, opportunitySchema, type OpportunityInput } from "./schemas";
import { OpportunityError, type OpportunityRecord, type OpportunityRepository, type OpportunityWrite, type StageWrite } from "./types";
import { provisionalCategories, provisionalStages } from "./defaults";

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;
  const fields: Record<string, string[]> = {};
  for (const issue of parsed.error.issues) (fields[String(issue.path[0] ?? "form")] ??= []).push(issue.message);
  throw new OpportunityError(422, "Review the opportunity details.", fields);
}
function validId(id: string) {
  if (!z.uuid().safeParse(id).success) throw new OpportunityError(400, "Invalid opportunity ID.");
  return id;
}
export function canEditOpportunity(access: AccessResult, record: Pick<OpportunityRecord, "owner_id" | "created_by">) {
  return access.status === "allowed" && isActivePseProfile(access.profile) && access.userId === access.profile.id
    && (record.owner_id === access.userId || record.created_by === access.userId || isPseManager(access.profile));
}
export function opportunityValues(record: OpportunityRecord): OpportunityInput {
  return {
    deal_name: record.deal_name, contact_id: record.contact_id, primary_contact_id: record.primary_contact_id ?? "", secondary_contact_id: record.secondary_contact_id ?? "",
    owner_id: record.owner_id, stage_id: record.stage_id, contribution_type: record.contribution_type as OpportunityInput["contribution_type"], contribution_category_id: record.contribution_category_id,
    expected_amount: String(record.expected_amount), operational_budget: record.operational_budget == null ? "" : String(record.operational_budget), currency: record.currency,
    payment_interval: record.payment_interval ?? "", expected_close_at: record.expected_close_at ?? "", country: record.country ?? "", description: record.description ?? "", notes: record.notes ?? "",
    drive_urls: record.drive_urls, valuation_note: record.valuation_note ?? "", valuation_reference_url: record.valuation_reference_url ?? "",
  };
}
function writeValues(input: OpportunityInput): OpportunityWrite {
  return { ...input, primary_contact_id: input.primary_contact_id || null, secondary_contact_id: input.secondary_contact_id || null,
    expected_amount: Number(input.expected_amount), operational_budget: input.operational_budget === "" ? null : Number(input.operational_budget),
    payment_interval: input.payment_interval || null, expected_close_at: input.expected_close_at || null, country: input.country || null,
    description: input.description || null, notes: input.notes || null, valuation_note: input.valuation_note || null, valuation_reference_url: input.valuation_reference_url || null };
}
export function createOpportunitiesService(repository: OpportunityRepository, access: AccessResult) {
  function authorize(manager = false) {
    if (access.status !== "allowed" || !isActivePseProfile(access.profile) || access.userId !== access.profile.id) throw new OpportunityError(access.status === "anonymous" ? 401 : access.status === "unavailable" ? 503 : 403, "PSE access is required.");
    if (manager && !isPseManager(access.profile)) throw new OpportunityError(403, "Only an authorized manager may configure the pipeline.");
    return access;
  }
  async function requireOpportunity(id: string) {
    const row = await repository.find(validId(id));
    if (!row) throw new OpportunityError(404, "Opportunity not found.");
    return row;
  }
  async function validate(input: OpportunityInput, current?: OpportunityRecord) {
    const actor = authorize();
    const fieldError = (field: string, message: string): never => { throw new OpportunityError(422, message, { [field]: [message] }); };
    if (input.owner_id !== (current?.owner_id ?? actor.userId) && !isPseManager(actor.profile)) throw new OpportunityError(403, "Only an authorized manager may assign another focal person.");
    const options = await repository.options();
    if (input.owner_id !== current?.owner_id && !options.owners.some(row => row.id === input.owner_id && row.active)) fieldError("owner_id", "Choose an active PSE focal person.");
    if (input.stage_id !== current?.stage_id && !options.stages.some(row => row.id === input.stage_id && row.active)) fieldError("stage_id", "Choose an active stage.");
    if (input.contribution_category_id !== current?.contribution_category_id && !options.categories.some(row => row.id === input.contribution_category_id && row.active)) fieldError("contribution_category_id", "Choose an active contribution category.");
    const party = await repository.contact(input.contact_id);
    if (!party) fieldError("contact_id", "Choose an existing contact.");
    if (party!.kind === "company" && !input.primary_contact_id) fieldError("primary_contact_id", "Choose a primary contact for this company.");
    if (party!.kind === "individual" && ((input.primary_contact_id && input.primary_contact_id !== input.contact_id) || input.secondary_contact_id)) fieldError("contact_id", "An individual deal uses that individual as its contact person.");
    for (const field of ["primary_contact_id", "secondary_contact_id"] as const) {
      if (input[field] && (await repository.contact(input[field]))?.kind !== "individual") fieldError(field, "Choose an individual contact.");
    }
  }
  return {
    async list(input: unknown) { authorize(); return repository.list(parse(opportunityListSchema, input)); },
    async get(id: string) { authorize(); return requireOpportunity(id); },
    async details(id: string) { authorize(); const opportunity = await requireOpportunity(id); return { opportunity, history: await repository.history(opportunity.id) }; },
    async options() { authorize(); return repository.options(); },
    async create(input: unknown) {
      const actor = authorize(); const data = parse(opportunitySchema, input); await validate(data);
      return repository.create(writeValues(data), actor.userId);
    },
    async update(id: string, input: unknown) {
      authorize(); const current = await requireOpportunity(id);
      if (!canEditOpportunity(access, current)) throw new OpportunityError(403, "Only the focal person, creator or an authorized manager may edit this opportunity.");
      const patch = parse(opportunityPatchSchema, input);
      const data = parse(opportunitySchema, { ...opportunityValues(current), ...patch });
      await validate(data, current);
      const saved = await repository.update(id, writeValues(data));
      if (!saved) throw new OpportunityError(403, "This opportunity could not be updated. Refresh to check your access.");
      return saved;
    },
    async configure(input: unknown) {
      authorize(true); const data = parse(configurationSchema, input);
      if (data.entity === "stage") {
        const { outcome, ...values } = data.values;
        await repository.saveStage({ ...values, is_closed: outcome !== "open", outcome: outcome === "open" ? null : outcome }, data.id);
      } else if (data.entity === "category") await repository.saveCategory(data.values, data.id);
      else {
        // Explicit opt-in. Add missing examples; never overwrite team configuration.
        const options = await repository.options();
        let position = Math.max(-1, ...options.stages.map(row => row.position)) + 1;
        for (const name of provisionalStages) {
          if (options.stages.some(row => row.name.toLowerCase() === name.toLowerCase())) continue;
          const outcome = ({ Won: "won", Lost: "lost", Abandoned: "abandoned" } as Record<string, StageWrite["outcome"]>)[name] ?? null;
          await repository.saveStage({ name, position: position++, outcome, is_closed: outcome !== null, active: true, is_provisional: true });
        }
        for (const [code, name] of provisionalCategories) {
          if (!options.categories.some(row => row.code === code)) await repository.saveCategory({ code, name, active: true, is_provisional: true });
        }
      }
      return repository.options();
    },
  };
}

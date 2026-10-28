import type { Tables, TablesInsert } from "@/types/database.types";
import { AppError } from "@/lib/errors";
import type { OpportunityListInput } from "./schemas";

export type Party = Pick<Tables<"contacts">, "id" | "name" | "kind" | "email" | "phone" | "website">;
export type Stage = Tables<"pipeline_stages">;
export type Category = Tables<"contribution_categories">;
export type Owner = Pick<Tables<"profiles">, "id" | "display_name" | "active">;
export type OpportunityOptions = { stages: Stage[]; categories: Category[]; owners: Owner[] };
export type OpportunityRecord = Tables<"opportunities"> & {
  contact: Party | null;
  primary_contact: Party | null;
  secondary_contact: Party | null;
  owner: Pick<Owner, "id" | "display_name"> | null;
  stage: Stage | null;
  category: Category | null;
};
export type OpportunityWrite = Omit<TablesInsert<"opportunities">, "id" | "created_by" | "created_at" | "updated_at">;
export type StageWrite = Pick<Stage, "name" | "position" | "outcome" | "is_closed" | "active" | "is_provisional">;
export type CategoryWrite = Pick<Category, "code" | "name" | "active" | "is_provisional">;
export type OpportunityHistory = {
  contributions: Pick<
    Tables<"recognized_contributions">,
    | "id"
    | "amount"
    | "currency"
    | "recognized_at"
    | "contribution_type"
    | "notes"
    | "corrects_contribution_id"
    | "correction_reason"
  >[];
  audits: (Pick<Tables<"audit_logs">, "id" | "action" | "before" | "after" | "created_at"> & {
    actor: { display_name: string } | null;
  })[];
};
export interface OpportunityRepository {
  list(input: OpportunityListInput): Promise<{ opportunities: OpportunityRecord[]; count: number }>;
  find(id: string): Promise<OpportunityRecord | null>;
  contact(id: string): Promise<Party | null>;
  options(): Promise<OpportunityOptions>;
  create(input: OpportunityWrite, actor: string): Promise<OpportunityRecord>;
  update(id: string, input: OpportunityWrite): Promise<OpportunityRecord | null>;
  remove(id: string): Promise<boolean>;
  history(id: string): Promise<OpportunityHistory>;
  saveStage(input: StageWrite, id?: string): Promise<void>;
  saveCategory(input: CategoryWrite, id?: string): Promise<void>;
}
export class OpportunityError extends AppError {
  name = "OpportunityError";
}

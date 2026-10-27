import "server-only";
import { requirePseUser } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";
import { createOpportunityRepository } from "./queries";
import { createOpportunitiesService } from "./service";
import { OpportunityError } from "./types";

export async function opportunityPageContext() {
  const access = await requirePseUser();
  return { access, service: createOpportunitiesService(createOpportunityRepository(await createClient()), access) };
}
export async function opportunityPageData<T>(load: () => Promise<T>) {
  try {
    return { ok: true as const, data: await load() };
  } catch (error) {
    if (error instanceof OpportunityError) return { ok: false as const, error };
    throw error;
  }
}

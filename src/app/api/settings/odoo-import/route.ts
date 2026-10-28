import { odooApi, readOdooJson } from "@/features/odoo/api";
import { invalidateReportCache } from "@/lib/cache/invalidation";
import { revalidateSections } from "@/lib/cache/paths";
// Manager only. Repeats the check and imports only when nothing needs review; all rows land or none do.
export async function POST(request: Request) {
  return odooApi(
    request,
    async service => {
      const result = await service.import(await readOdooJson(request));
      invalidateReportCache(false);
      revalidateSections("/contacts", "/opportunities", "/activities", "/dashboard", "/reports");
      return { data: { result }, status: 201 };
    },
    true,
    true,
  );
}

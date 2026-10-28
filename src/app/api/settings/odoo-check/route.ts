import { odooApi, readOdooJson } from "@/features/odoo/api";
// Manager only. POST because the request carries the files; nothing is stored or written.
export async function POST(request: Request) {
  return odooApi(
    request,
    async service => ({ data: { report: await service.check(await readOdooJson(request)) } }),
    true,
    true,
  );
}

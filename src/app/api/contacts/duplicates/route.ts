import { contactApi, readContactJson } from "@/features/contacts/api";

export async function POST(request: Request) {
  return contactApi(request, async service => ({ data: { duplicates: await service.checkDuplicates(await readContactJson(request)) } }), true);
}

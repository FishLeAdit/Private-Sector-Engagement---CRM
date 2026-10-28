import { accountApi, readAccountJson } from "@/features/accounts/api";
export async function GET(request: Request) {
  return accountApi(request, async service => ({ data: { accounts: await service.list() } }));
}
export async function POST(request: Request) {
  return accountApi(
    request,
    async service => ({ data: { account: await service.create(await readAccountJson(request)) }, status: 201 }),
    true,
  );
}

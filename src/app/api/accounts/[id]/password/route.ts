import { accountApi, readAccountJson } from "@/features/accounts/api";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return accountApi(
    request,
    async service => ({
      data: { account: await service.setPassword((await params).id, await readAccountJson(request)) },
    }),
    true,
  );
}

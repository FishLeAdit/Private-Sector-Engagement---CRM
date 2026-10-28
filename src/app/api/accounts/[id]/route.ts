import { accountApi, readAccountJson } from "@/features/accounts/api";
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, { params }: Context) {
  return accountApi(
    request,
    async service => ({ data: { account: await service.update((await params).id, await readAccountJson(request)) } }),
    true,
  );
}
export async function DELETE(request: Request, { params }: Context) {
  return accountApi(request, async service => ({ data: await service.remove((await params).id) }), true);
}

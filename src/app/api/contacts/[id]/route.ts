import { contactApi, invalidateContact, readContactJson } from "@/features/contacts/api";

type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  return contactApi(request, async service => ({ data: { contact: await service.get((await context.params).id) } }));
}

export async function PATCH(request: Request, context: Context) {
  return contactApi(
    request,
    async service => {
      const contact = await service.update((await context.params).id, await readContactJson(request));
      invalidateContact(contact.id);
      return { data: { contact } };
    },
    true,
  );
}

export async function DELETE(request: Request, context: Context) {
  return contactApi(
    request,
    async service => {
      const deleted = await service.remove((await context.params).id);
      invalidateContact(deleted.id);
      return { data: deleted };
    },
    true,
  );
}

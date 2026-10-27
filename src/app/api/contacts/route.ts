import { contactApi, invalidateContact, readContactJson } from "@/features/contacts/api";

export async function GET(request: Request) {
  return contactApi(request, async service => ({
    data: await service.list(Object.fromEntries(new URL(request.url).searchParams)),
  }));
}

export async function POST(request: Request) {
  return contactApi(
    request,
    async service => {
      const contact = await service.create(await readContactJson(request));
      invalidateContact(contact.id);
      return { data: { contact }, status: 201 };
    },
    true,
  );
}

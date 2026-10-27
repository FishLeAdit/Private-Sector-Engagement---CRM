import { contributionApi } from "@/features/contributions/context";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return contributionApi(request, async service => ({ contribution: await service.contribution((await params).id) }));
}

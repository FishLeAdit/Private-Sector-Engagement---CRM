import Link from "next/link";
import { meetingPageContext, meetingPageData } from "@/features/meetings/context";
import { meetingOptionsSchema } from "@/features/meetings/schemas";
import { isPseManager } from "@/lib/auth/roles";
import { MeetingForm } from "@/components/meetings/meeting-form";
import { MeetingProblem } from "@/components/meetings/meeting-state";
export default async function NewMeetingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { access, service } = await meetingPageContext();
  const parsed = meetingOptionsSchema.safeParse(await searchParams);
  if (!parsed.success) return <MeetingProblem message="Choose valid contact/opportunity links." />;
  const result = await meetingPageData(() => service.options(parsed.data));
  if (!result.ok) return <MeetingProblem message={result.error.message} />;
  return <><Link href="/meetings" className="link text-sm">← Meetings</Link><h1 className="mb-7 mt-4 text-3xl font-bold">New meeting</h1><MeetingForm options={result.data} manager={isPseManager(access.profile)} userId={access.userId} /></>;
}

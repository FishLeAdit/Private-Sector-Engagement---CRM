import Link from "next/link";
import { notFound } from "next/navigation";
import { meetingPageContext, meetingPageData } from "@/features/meetings/context";
import { canEditMeeting, meetingValues } from "@/features/meetings/service";
import { isPseManager } from "@/lib/auth/roles";
import { MeetingForm } from "@/components/meetings/meeting-form";
import { MeetingProblem } from "@/components/meetings/meeting-state";
import { SysCode } from "@/components/ui/hud";
export default async function EditMeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { access, service } = await meetingPageContext();
  const { id } = await params;
  const result = await meetingPageData(() => Promise.all([service.get(id), service.options()]));
  if (!result.ok) {
    if ([400, 404].includes(result.error.status)) notFound();
    return <MeetingProblem message={result.error.message} />;
  }
  const [row, options] = result.data;
  if (!canEditMeeting(access, row))
    return <MeetingProblem message="Only the owner, creator or an authorized manager may edit this meeting." />;
  const owners = options.owners.some(owner => owner.id === row.owner_id)
    ? options.owners
    : [...options.owners, { id: row.owner_id, display_name: row.owner?.display_name ?? "Former owner", active: false }];
  return (
    <>
      <Link href={`/meetings/${id}`} className="link text-sm">
        ← Meeting details
      </Link>
      <SysCode className="mt-4 mb-1 block">{"SYS.MTG // EDIT"}</SysCode>
      <h1 className="mb-7 text-3xl font-bold">Edit meeting</h1>
      <MeetingForm
        meetingId={id}
        initial={meetingValues(row)}
        options={{ owners, contact: row.contact, opportunity: row.opportunity }}
        manager={isPseManager(access.profile)}
        userId={access.userId}
      />
    </>
  );
}

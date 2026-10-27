import { ConfirmDeleteButton } from "@/components/ui/confirm-delete-button";

export function DeleteMeetingButton({ meetingId, title }: { meetingId: string; title: string }) {
  return (
    <ConfirmDeleteButton
      noun="meeting"
      name={title}
      endpoint={`/api/meetings/${meetingId}`}
      redirectTo="/meetings?deleted=1"
      consequences="This permanently removes the meeting. Audit history is retained. Linked activities or follow-up tasks block deletion. Contacts and opportunities are kept."
    />
  );
}

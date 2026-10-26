import Link from "next/link";
export function MeetingProblem({ message }: { message: string }) {
  return <section role="alert" className="space-y-4 rounded-lg border border-base-300 p-6"><h1 className="text-xl font-bold">Meetings could not be loaded</h1><p>{message}</p><Link href="/meetings" className="btn btn-outline">Return to meetings</Link></section>;
}

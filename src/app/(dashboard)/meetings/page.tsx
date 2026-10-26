import Link from "next/link";
import { redirect } from "next/navigation";
import { meetingPageContext, meetingPageData } from "@/features/meetings/context";
import { MEETING_PAGE_SIZE, meetingListSchema } from "@/features/meetings/schemas";
import { MeetingProblem } from "@/components/meetings/meeting-state";
import { meetingContact } from "@/components/meetings/contact-information";
import { formatDate } from "@/lib/dates";
export default async function MeetingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { service } = await meetingPageContext();
  const { deleted, ...filters } = await searchParams;
  const parsed = meetingListSchema.safeParse(filters);
  if (!parsed.success) return <MeetingProblem message={parsed.error.issues[0]?.message ?? "Choose valid meeting filters."} />;
  const input = parsed.data;
  const result = await meetingPageData(() => Promise.all([service.list(input), service.options({ contact_id: input.contact_id, opportunity_id: input.opportunity_id })]));
  if (!result.ok) return <MeetingProblem message={result.error.message} />;
  const [{ meetings, count }, options] = result.data, pages = Math.max(1, Math.ceil(count / MEETING_PAGE_SIZE));
  const link = (page: number) => `/meetings?${new URLSearchParams(Object.fromEntries(Object.entries({ ...input, page }).map(([key, value]) => [key, String(value)])))}`;
  if (input.page > pages) redirect(link(pages));
  return <>
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-bold">Meetings</h1><p className="mt-2 text-base-content/65">Schedule conversations, record completion and keep linked follow-up tasks.</p></div><Link href="/meetings/new" className="btn btn-primary">New meeting</Link></div>
    {deleted === "1" && <p role="status" className="mb-5 rounded-lg bg-success/10 p-4 text-success">Meeting deleted successfully.</p>}
    <form action="/meetings" className="mb-5 rounded-xl border border-base-300 p-4">
      {input.contact_id && <input type="hidden" name="contact_id" value={input.contact_id} />}{input.opportunity_id && <input type="hidden" name="opportunity_id" value={input.opportunity_id} />}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><label className="block text-xs">Meeting title<input name="q" maxLength={100} defaultValue={input.q} className="input input-bordered mt-1 w-full" placeholder="Search meetings" /></label>
        <label className="block text-xs">View<select name="period" defaultValue={input.period} className="select select-bordered mt-1 w-full"><option value="all">All meetings</option><option value="upcoming">Upcoming scheduled</option><option value="completed">Completed</option></select></label>
        <label className="block text-xs">Status<select name="status" defaultValue={input.status} className="select select-bordered mt-1 w-full"><option value="all">All statuses</option><option value="scheduled">Scheduled</option><option value="done">Done</option><option value="cancelled">Cancelled</option></select></label>
        <label className="block text-xs">Owner<select name="owner_id" defaultValue={input.owner_id} className="select select-bordered mt-1 w-full"><option value="">All owners</option>{options.owners.map(row => <option key={row.id} value={row.id}>{row.display_name}{!row.active && " (inactive)"}</option>)}</select></label>
        <label className="block text-xs">Meeting date from (Dhaka)<input type="date" name="from" defaultValue={input.from} className="input input-bordered mt-1 w-full" /></label><label className="block text-xs">Meeting date to (Dhaka)<input type="date" name="to" defaultValue={input.to} className="input input-bordered mt-1 w-full" /></label>
      </div>{(options.contact || options.opportunity) && <p className="mt-4 text-sm text-base-content/65">{options.contact && `Direct contact link: ${options.contact.name}. `}{options.opportunity && `Opportunity: ${options.opportunity.deal_name}.`}</p>}
      <div className="mt-4 flex gap-2"><button className="btn btn-outline btn-sm">Apply filters</button><Link href="/meetings" className="btn btn-ghost btn-sm">Reset</Link></div>
    </form>
    <p className="mb-4 text-xs text-base-content/60">Times use Asia/Dhaka. Upcoming means Scheduled from now onward; Completed means Done. View and status filters apply together.</p>
    <div className="overflow-x-auto rounded-xl border border-base-300">{meetings.length ? <table className="table"><caption className="sr-only">Meetings matching the selected filters</caption><thead><tr><th>Meeting</th><th>Date/time (Dhaka)</th><th>Status</th><th>Contact / opportunity</th><th>Owner</th></tr></thead><tbody>{meetings.map(row => {
      const contact = meetingContact(row.contact, row.opportunity);
      return <tr key={row.id}><td><Link href={`/meetings/${row.id}`} className="link link-hover font-semibold">{row.title}</Link></td><td className="whitespace-nowrap">{formatDate(row.scheduled_at, true)}</td><td><span className={`badge ${row.status === "done" ? "badge-success" : row.status === "cancelled" ? "badge-ghost" : "badge-info"}`}>{row.status === "done" ? "Done" : row.status === "cancelled" ? "Cancelled" : "Scheduled"}</span></td><td>{contact && <Link href={`/contacts/${contact.id}`} className="link link-hover">{contact.name}</Link>}{row.opportunity && <p className="mt-1 text-xs text-base-content/65"><Link href={`/opportunities/${row.opportunity.id}`} className="link link-hover">{row.opportunity.deal_name}</Link></p>}</td><td>{row.owner?.display_name ?? "Former owner"}</td></tr>;
    })}</tbody></table> : <section className="p-10 text-center"><h2 className="text-xl font-semibold">No matching meetings</h2><p className="my-3 text-base-content/65">Schedule a meeting or adjust your filters.</p><Link href="/meetings/new" className="btn btn-outline">New meeting</Link></section>}</div>
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm"><p>{count} matching meetings · Page {input.page} of {pages}</p><nav aria-label="Meeting pages" className="flex gap-2">{input.page > 1 && <Link href={link(input.page - 1)} className="btn btn-outline btn-sm">Previous</Link>}{input.page < pages && <Link href={link(input.page + 1)} className="btn btn-outline btn-sm">Next</Link>}</nav></div>
  </>;
}

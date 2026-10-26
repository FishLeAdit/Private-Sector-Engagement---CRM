export default function ContactsLoading() {
  return <div role="status" aria-label="Loading contacts" className="space-y-5"><div className="skeleton h-10 w-48" /><div className="skeleton h-24 w-full" /><div className="skeleton h-72 w-full" /><span className="sr-only">Loading contacts…</span></div>;
}

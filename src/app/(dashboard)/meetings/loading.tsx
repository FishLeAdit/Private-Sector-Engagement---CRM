export default function Loading() {
  return (
    <div className="space-y-5" role="status">
      <p className="text-sm">Loading meetings…</p>
      <div className="skeleton h-12 w-64" />
      <div className="skeleton h-80 w-full" />
    </div>
  );
}

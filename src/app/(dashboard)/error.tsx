"use client";

export default function DashboardError({ reset }: { reset: () => void }) {
  return <section className="space-y-4" role="alert">
    <h1 className="text-2xl font-bold">Unable to load your workspace</h1>
    <p>Please try again shortly. If this continues, contact your administrator.</p>
    <button className="btn btn-primary" onClick={reset}>Try again</button>
  </section>;
}

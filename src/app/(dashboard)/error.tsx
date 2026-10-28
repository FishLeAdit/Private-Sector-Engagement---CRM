"use client";
import { StatusPip, SysCode } from "@/components/ui/hud";

export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <section className="panel max-w-xl space-y-4 p-6" role="alert">
      <div className="flex items-center justify-between gap-3">
        <SysCode>SYS.ERR // WS-01</SysCode>
        <StatusPip tone="critical" label="Fault" />
      </div>
      <h1 className="font-mono text-2xl font-semibold">Unable to load your workspace</h1>
      <p className="text-sm text-muted">Please try again shortly. If this continues, contact your administrator.</p>
      <button className="btn btn-primary" onClick={reset}>
        Try again
      </button>
    </section>
  );
}

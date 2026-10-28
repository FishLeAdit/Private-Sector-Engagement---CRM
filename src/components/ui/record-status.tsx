import { StatusPip } from "./hud";

// A record's state as a status pip: cyan while it is still active (scheduled, open, in progress, an open deal),
// grey once settled (done, won, cancelled, closed without winning). The label always carries the meaning, and
// table pips never blink: motion is kept for live system states.
const active = new Set(["scheduled", "open", "in_progress"]);

export function RecordStatus({ status, label }: { status: string; label: string }) {
  return <StatusPip tone={active.has(status) ? "nominal" : "idle"} label={label} />;
}

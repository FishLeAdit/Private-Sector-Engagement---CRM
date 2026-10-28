import type { ComponentProps, ReactNode } from "react";

// Avionics building blocks shared by the shell, dashboards and module pages. Meaning never rides on colour
// alone: every status carries a text label, and system strings are decorative and hidden from assistive tech.

export type Tone = "nominal" | "warning" | "critical" | "idle";
const toneText: Record<Tone, string> = {
  nominal: "text-success",
  warning: "text-warning",
  critical: "text-error",
  idle: "text-decor",
};

// A module string such as "SYS.FIN // FND-01". Build it from real context (module code, period, count).
export function SysCode({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span aria-hidden="true" className={`font-mono text-[0.65rem] uppercase tracking-[0.2em] text-decor ${className}`}>
      {children}
    </span>
  );
}

export function StatusPip({ tone = "nominal", label, blink = false }: { tone?: Tone; label: string; blink?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider">
      <span aria-hidden="true" className={`pip ${toneText[tone]} ${blink ? "pip-blink" : ""}`} />
      <span>{label}</span>
    </span>
  );
}

// A hardware panel (translucent surface, hairline border, corner ticks). Pass aria props as for <section>.
export function Panel({ className = "", children, ...props }: ComponentProps<"section">) {
  return (
    <section className={`panel p-5 ${className}`} {...props}>
      {children}
    </section>
  );
}

// A panel or page heading: mono title, an optional system string, and actions on the right.
export function PanelHeader({
  title,
  code,
  id,
  level = 2,
  children,
}: {
  title: ReactNode;
  code?: string;
  id?: string;
  level?: 1 | 2 | 3;
  children?: ReactNode;
}) {
  const Heading = `h${level}` as const;
  const size = level === 1 ? "text-2xl sm:text-3xl" : level === 2 ? "text-sm" : "text-xs";
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {code && <SysCode className="mb-1 block">{code}</SysCode>}
        <Heading id={id} className={`font-mono font-semibold ${size} break-words`}>
          {title}
        </Heading>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

// A labelled figure: mono label above a large sans value, with optional detail underneath.
export function Readout({
  label,
  value,
  detail,
  size = "md",
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  size?: "md" | "lg" | "hero";
}) {
  const valueSize = size === "hero" ? "text-5xl sm:text-6xl" : size === "lg" ? "text-3xl" : "text-xl";
  return (
    <div className="min-w-0">
      <p className="hud-label">{label}</p>
      <p className={`mt-2 break-words font-sans font-semibold tabular-nums ${valueSize}`}>{value}</p>
      {detail && <p className="mt-1 text-xs text-muted">{detail}</p>}
    </div>
  );
}

// Compact key/value chips, e.g. record counts in a status strip.
export function DataBlock({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="flex flex-wrap gap-2">
      {items.map(([key, value]) => (
        <div key={key} className="flex items-baseline gap-2 border border-base-300 px-2 py-1 font-mono text-xs">
          <dt className="uppercase tracking-wider text-muted">{key}</dt>
          <dd className="tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

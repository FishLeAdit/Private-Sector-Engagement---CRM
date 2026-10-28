import type { ReactNode } from "react";
import { SysCode } from "@/components/ui/hud";

export type LegendItem = { label: string; tone: "accent" | "neutral"; mark: "bar" | "line" | "outline" };
export type ChartTable = { columns: string[]; rows: string[][] };

const swatch: Record<LegendItem["mark"], string> = {
  bar: "h-2.5 w-2.5",
  line: "h-0.5 w-4",
  outline: "h-2.5 w-2.5 border bg-transparent",
};

// Every chart sits in one of these: a captioned figure whose plot is hidden from assistive technology and
// mirrored by a visually hidden table, so every value is readable without the chart, a mouse or colour.
export function ChartFrame({
  title,
  code,
  legend = [],
  table,
  empty = false,
  emptyText = "No records in this period.",
  note,
  children,
}: {
  title: string;
  code?: string;
  legend?: LegendItem[];
  table: ChartTable;
  empty?: boolean;
  emptyText?: string;
  note?: ReactNode;
  children: ReactNode;
}) {
  // Chart titles are unique on a page, so the title doubles as the id.
  const titleId = `chart-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    // Named explicitly: not every browser or screen reader names a figure from its figcaption.
    <figure aria-labelledby={titleId} className="panel min-w-0 p-5">
      <figcaption className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <span className="min-w-0">
          {code && <SysCode className="mb-1 block">{code}</SysCode>}
          <span id={titleId} className="block font-mono text-xs font-semibold uppercase tracking-[0.1em]">
            {title}
          </span>
        </span>
        {legend.length > 1 && !empty && (
          <span aria-hidden="true" className="flex flex-wrap gap-3 font-mono text-[0.7rem] text-muted">
            {legend.map(item => (
              <span key={item.label} className="inline-flex items-center gap-1.5">
                <span
                  className={`inline-block ${swatch[item.mark]}`}
                  style={
                    item.mark === "outline"
                      ? { borderColor: `var(--chart-${item.tone})` }
                      : { backgroundColor: `var(--chart-${item.tone})` }
                  }
                />
                {item.label}
              </span>
            ))}
          </span>
        )}
      </figcaption>
      {empty ? (
        <p className="py-8 text-center font-mono text-xs uppercase tracking-wider text-muted">{emptyText}</p>
      ) : (
        <>
          <div aria-hidden="true">{children}</div>
          {/* A table ignores sr-only's 1px width, so the box around it carries the clipping. */}
          <div className="sr-only">
            <table>
              <caption>{title}</caption>
              <thead>
                <tr>
                  {table.columns.map(column => (
                    <th key={column} scope="col">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, index) => (
                  <tr key={`${index}:${row[0]}`}>
                    {row.map((cell, i) =>
                      i === 0 ? (
                        <th key={i} scope="row">
                          {cell}
                        </th>
                      ) : (
                        <td key={i}>{cell}</td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {note && <p className="mt-3 text-xs text-muted">{note}</p>}
    </figure>
  );
}

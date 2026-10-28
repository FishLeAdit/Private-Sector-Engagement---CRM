"use client";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "./chart-tooltip";
import { monoFont, useChartTheme } from "./chart-theme";
import { compact } from "./format";

export type PaceRow = {
  label: string; // "Q1"
  target: number | null;
  targetLabel: string;
  actual: number | null;
  actualLabel: string;
};

// Cumulative actual against cumulative quarterly target on one axis: are we on pace for the year? The actual
// line stops at the current quarter rather than dropping to zero for quarters still ahead.
export function PaceChart({ rows }: { rows: PaceRow[] }) {
  const theme = useChartTheme();
  const dot = (color: string) => ({ r: 4, fill: color, stroke: theme.surface, strokeWidth: 2 });
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={rows} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={theme.grid} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={{ stroke: theme.grid }}
          tick={{ fill: theme.muted, fontSize: 11, fontFamily: monoFont }}
        />
        <YAxis
          width={52}
          tickLine={false}
          axisLine={false}
          tickFormatter={compact}
          tick={{ fill: theme.muted, fontSize: 11, fontFamily: monoFont }}
        />
        <Tooltip cursor={{ stroke: theme.muted, strokeWidth: 1 }} content={props => <ChartTooltip {...props} />} />
        <Line
          dataKey="target"
          name="Cumulative target"
          stroke={theme.neutral}
          strokeWidth={2}
          dot={dot(theme.neutral)}
          activeDot={dot(theme.neutral)}
          isAnimationActive={false}
        />
        <Line
          dataKey="actual"
          name="Cumulative actual"
          stroke={theme.accent}
          strokeWidth={2}
          dot={dot(theme.accent)}
          activeDot={{ ...dot(theme.accent), r: 5 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

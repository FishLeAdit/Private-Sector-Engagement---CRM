"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "./chart-tooltip";
import { monoFont, useChartTheme } from "./chart-theme";
import { compact } from "./format";

export type MonthSeries = { key: string; name: string; tone: "accent" | "neutral" };

// Columns per month for one measure, or a context measure (neutral) beside the one that matters (accent),
// e.g. logged activities and the Done ones. Each row carries `<key>` (number) and `<key>Label` (text).
export function MonthColumns({ rows, series }: { rows: Record<string, string | number>[]; series: MonthSeries[] }) {
  const theme = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2} barCategoryGap="25%">
        <CartesianGrid vertical={false} stroke={theme.grid} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={{ stroke: theme.grid }}
          interval={0}
          tick={{ fill: theme.muted, fontSize: 10, fontFamily: monoFont }}
        />
        <YAxis
          width={44}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          tickFormatter={compact}
          tick={{ fill: theme.muted, fontSize: 11, fontFamily: monoFont }}
        />
        <Tooltip cursor={{ fill: theme.grid, opacity: 0.35 }} content={props => <ChartTooltip {...props} />} />
        {series.map(s => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            maxBarSize={18}
            fill={s.tone === "accent" ? theme.accent : theme.neutral}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

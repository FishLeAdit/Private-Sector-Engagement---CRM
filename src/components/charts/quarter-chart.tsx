"use client";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "./chart-tooltip";
import { monoFont, useChartTheme } from "./chart-theme";
import { compact } from "./format";

export type QuarterRow = {
  label: string; // "Q1"
  target: number | null;
  targetLabel: string;
  actual: number | null;
  actualLabel: string;
  attainment: string; // "110%" or "" — the one direct label per quarter.
};

// Target as an outline column beside the actual as a filled one, so each quarter reads on its own:
// overachievement is the actual rising past its outline, labelled with its attainment.
export function QuarterChart({ rows }: { rows: QuarterRow[] }) {
  const theme = useChartTheme();
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={rows} margin={{ top: 20, right: 8, bottom: 0, left: 0 }} barGap={2} barCategoryGap="30%">
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
        <Tooltip cursor={{ fill: theme.grid, opacity: 0.35 }} content={props => <ChartTooltip {...props} />} />
        <Bar
          dataKey="target"
          name="Target"
          barSize={20}
          fill="transparent"
          stroke={theme.neutral}
          strokeWidth={1}
          isAnimationActive={false}
        />
        <Bar dataKey="actual" name="Actual" barSize={20} fill={theme.accent} isAnimationActive={false}>
          <LabelList dataKey="attainment" position="top" fill={theme.text} fontSize={11} fontFamily={monoFont} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

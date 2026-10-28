"use client";
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "./chart-tooltip";
import { monoFont, useChartTheme } from "./chart-theme";

export type CategoryRow = {
  label: string;
  value: number;
  valueLabel: string; // Shown at the bar tip and in the tooltip.
  tone?: "accent" | "neutral"; // Emphasis: accent for what the chart is about, neutral for context.
};

const shorten = (text: string) => (text.length > 26 ? `${text.slice(0, 25)}…` : text);

// Horizontal bars for comparing categories (one hue, or accent plus grey for emphasis). Bars stay thin, start
// from one baseline and carry their value at the tip. Axis names stay on one line (shortened if long; the
// tooltip and table keep them whole), and the scale leaves headroom so tip labels never wrap.
export function CategoryBars({ rows, series }: { rows: CategoryRow[]; series: string }) {
  const theme = useChartTheme();
  // The name column fits the longest (shortened) name, so short-named charts keep room for bars and labels.
  const labelWidth = Math.min(180, Math.max(...rows.map(r => shorten(r.label).length), 4) * 6.8 + 14);
  return (
    <ResponsiveContainer width="100%" height={rows.length * 30 + 8}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 8, bottom: 4, left: 0 }} barCategoryGap={8}>
        <XAxis type="number" hide domain={[0, (max: number) => Math.max(max, 1) * 1.8]} />
        <YAxis
          type="category"
          dataKey="label"
          width={labelWidth}
          tickLine={false}
          axisLine={{ stroke: theme.grid }}
          tick={props => (
            <text
              x={props.x}
              y={props.y}
              dy={4}
              textAnchor="end"
              fill={theme.muted}
              fontSize={11}
              fontFamily={monoFont}
            >
              {shorten(String(props.payload?.value ?? ""))}
            </text>
          )}
        />
        <Tooltip cursor={{ fill: theme.grid, opacity: 0.35 }} content={props => <ChartTooltip {...props} />} />
        <Bar dataKey="value" name={series} barSize={14} isAnimationActive={false}>
          {rows.map(row => (
            <Cell key={row.label} fill={row.tone === "neutral" ? theme.neutral : theme.accent} />
          ))}
          {/* Plain text, so the tip label stays on one line (recharts would wrap it to the space left). */}
          <LabelList
            dataKey="valueLabel"
            content={props => (
              <text
                x={Number(props.x) + Number(props.width) + 6}
                y={Number(props.y) + Number(props.height) / 2}
                dy={4}
                fill={theme.text}
                fontSize={11}
                fontFamily={monoFont}
              >
                {String(props.value ?? "")}
              </text>
            )}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

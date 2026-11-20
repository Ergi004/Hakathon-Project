"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

/** Small labelled bar chart; always paired with a text summary for screen readers (SPEC 3). */
export function WeeklyBars({ data, label, summary, color = "var(--chart-1)", xKey = "week", yKey = "count" }: { data: Record<string, string | number>[]; label: string; summary: string; color?: string; xKey?: string; yKey?: string }) {
  const config = { [yKey]: { label, color } } satisfies ChartConfig;
  return (
    <figure className="space-y-2">
      <ChartContainer config={config} className="aspect-auto h-56 w-full" aria-hidden="true">
        <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey={xKey} tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} fontSize={11} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} fontSize={11} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey={yKey} fill={`var(--color-${yKey})`} radius={4} />
        </BarChart>
      </ChartContainer>
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  );
}

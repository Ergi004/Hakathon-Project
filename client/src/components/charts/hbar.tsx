"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

/** Horizontal bars with labelled axes and a screen-reader summary. */
export function HBar({ data, label, summary, color = "var(--chart-1)" }: { data: { name: string; value: number }[]; label: string; summary: string; color?: string }) {
  const config = { value: { label, color } } satisfies ChartConfig;
  return (
    <figure>
      <ChartContainer config={config} className="aspect-auto w-full" style={{ height: Math.max(160, data.length * 30) }} aria-hidden="true">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
          <CartesianGrid horizontal={false} />
          <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} />
          <YAxis type="category" dataKey="name" width={130} tickLine={false} axisLine={false} fontSize={11} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="value" fill="var(--color-value)" radius={4} />
        </BarChart>
      </ChartContainer>
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  );
}

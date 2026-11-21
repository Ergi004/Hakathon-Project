"use client";

import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

/** Weekly reports attributed to campaigns (bars) and newly opened campaigns (line). */
export function CampaignActivity({
  data,
  labels,
  summary,
}: {
  data: { label: string; reports: number; campaigns: number }[];
  labels: { reports: string; campaigns: string };
  summary: string;
}) {
  const config = {
    reports: { label: labels.reports, color: "var(--chart-1)" },
    campaigns: { label: labels.campaigns, color: "var(--chart-4)" },
  } satisfies ChartConfig;
  return (
    <figure>
      <ChartContainer config={config} className="aspect-auto h-64 w-full" aria-hidden="true">
        <ComposedChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={12} fontSize={11} />
          <YAxis yAxisId="reports" allowDecimals={false} tickLine={false} axisLine={false} width={36} fontSize={11} />
          <YAxis yAxisId="campaigns" orientation="right" allowDecimals={false} tickLine={false} axisLine={false} width={28} fontSize={11} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar yAxisId="reports" dataKey="reports" fill="var(--color-reports)" radius={[4, 4, 0, 0]} />
          <Line yAxisId="campaigns" dataKey="campaigns" type="monotone" stroke="var(--color-campaigns)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
        </ComposedChart>
      </ChartContainer>
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  );
}

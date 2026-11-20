"use client";

import { useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

const FLAGS = ["green", "yellow", "orange", "red", "darkred", "grey"] as const;

/** Stacked daily volume by flag with flag colours and a text summary (SPEC 3). */
export function FlagStack({ data, summary }: { data: Record<string, string | number>[]; summary: string }) {
  const t = useTranslations("flags");
  const config = Object.fromEntries(FLAGS.map((f) => [f, { label: t(f), color: `var(--flag-${f})` }])) satisfies ChartConfig;
  return (
    <figure>
      <ChartContainer config={config} className="aspect-auto h-64 w-full" aria-hidden="true">
        <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} fontSize={11} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          {FLAGS.map((f, i) => (
            <Bar key={f} dataKey={f} stackId="a" fill={`var(--color-${f})`} radius={i === FLAGS.length - 1 ? [4, 4, 0, 0] : 0} />
          ))}
        </BarChart>
      </ChartContainer>
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  );
}

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Section({ id, title, subtitle, action, children, className }: { id?: string; title: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className={cn("mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-20", className)}>
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <h2 id={id ? `${id}-title` : undefined} className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
          {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

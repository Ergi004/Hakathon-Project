import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Wide page container shared by the public header, landing page and footer. */
export const WIDE = "mx-auto w-full max-w-[100rem] px-4 sm:px-6 lg:px-10";

export function Section({ id, title, subtitle, action, children, className }: { id?: string; title: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className={cn(WIDE, "scroll-mt-20 py-16 md:py-24", className)}>
      <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl space-y-2">
          <h2 id={id ? `${id}-title` : undefined} className="font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">{title}</h2>
          {subtitle && <p className="text-lg text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Sparkline } from "@/components/charts/sparkline";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Full-width dashboard page with the shared header (citizen, business, SOC). */
export function DashPage({ title, subtitle, actions, children, className }: { title: string; subtitle?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto w-full max-w-[100rem] space-y-6", className)}>
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
          {subtitle && <p className="max-w-3xl text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </header>
      {children}
    </div>
  );
}

/** Number with an icon tile and a label; optional sparkline. */
export function StatCard({ icon: Icon, label, value, tone = "text-primary", series, hint }: { icon: LucideIcon; label: string; value: ReactNode; tone?: string; series?: number[]; hint?: string }) {
  return (
    <Card className="h-full gap-3 py-4">
      <CardContent className="space-y-3 px-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted"><Icon className={cn("size-5", tone)} aria-hidden="true" /></span>
          <div className="min-w-0">
            <p className="font-display text-2xl leading-none font-bold tabular-nums">{value}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
        {series && series.length > 1 && <Sparkline data={series} />}
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

/** Centered empty state used inside cards. */
export function EmptyPanel({ icon: Icon, title, body, action, tone = "text-muted-foreground" }: { icon: LucideIcon; title: string; body?: string; action?: ReactNode; tone?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-muted"><Icon className={cn("size-6", tone)} aria-hidden="true" /></span>
      <p className="font-medium">{title}</p>
      {body && <p className="max-w-md text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Two-column settings section: title and hint on the left, controls on the right. */
export function SettingsRow({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 py-6 first:pt-0 md:grid-cols-[18rem_1fr] md:gap-10 lg:grid-cols-[22rem_1fr]">
      <div className="space-y-1">
        <h2 className="font-display text-lg font-medium">{title}</h2>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

/** Titled card section. `flush` drops the content padding for tables and divided lists. */
export function Panel({ title, icon: Icon, iconTone = "text-primary", description, action, children, className, flush }: { title: ReactNode; icon?: LucideIcon; iconTone?: string; description?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <Card className={cn(flush && "gap-0 py-0", className)}>
      <CardHeader className={cn(flush && "border-b border-border py-5")}>
        <CardTitle className="inline-flex items-center gap-2 font-display text-lg">
          {Icon && <Icon className={cn("size-5", iconTone)} aria-hidden="true" />}
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent className={cn(flush && "p-0")}>{children}</CardContent>
    </Card>
  );
}

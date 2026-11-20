import type { ReactNode } from "react";
import { ShieldOff } from "lucide-react";
import { cn } from "@/lib/utils";

/** Designed empty state with one call to action (SPEC 3, 8). */
export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-6 py-12 text-center",
        className,
      )}
    >
      <div className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground" aria-hidden="true">
        {icon ?? <ShieldOff className="size-5" />}
      </div>
      <div className="space-y-1">
        <p className="font-display text-lg font-medium">{title}</p>
        {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

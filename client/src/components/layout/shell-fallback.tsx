import { Skeleton } from "@/components/ui/skeleton";

/** Shown while an area layout verifies the session (never a bare spinner). */
export function ShellFallback() {
  return (
    <div className="flex flex-1">
      <div className="hidden w-64 shrink-0 space-y-3 border-r border-border p-4 md:block">
        <Skeleton className="h-8 w-32" />
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-full" />
        ))}
      </div>
      <div className="flex-1 space-y-4 p-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}

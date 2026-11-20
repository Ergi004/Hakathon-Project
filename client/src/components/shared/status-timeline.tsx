import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TimelineStep {
  key: string;
  label: string;
  at?: string | null;
  note?: string | null;
  state: "done" | "current" | "pending" | "skipped";
}

/** Pipeline for reports, campaigns and notices with timestamps (SPEC 3). */
export function StatusTimeline({ steps, orientation = "vertical" }: { steps: TimelineStep[]; orientation?: "vertical" | "horizontal" }) {
  if (orientation === "horizontal") {
    return (
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-3">
        {steps.map((s, i) => (
          <li key={s.key} className="flex items-center gap-2" aria-current={s.state === "current" ? "step" : undefined}>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                s.state === "done" && "border-primary/40 bg-primary/10",
                s.state === "current" && "border-primary bg-primary text-primary-foreground",
                (s.state === "pending" || s.state === "skipped") && "border-border text-muted-foreground",
              )}
            >
              {s.state === "done" ? <Check className="size-3" aria-hidden="true" /> : <Circle className="size-3" aria-hidden="true" />}
              {s.label}
            </span>
            {i < steps.length - 1 && <span aria-hidden="true" className="h-px w-4 bg-border" />}
          </li>
        ))}
      </ol>
    );
  }
  return (
    <ol className="relative space-y-5 border-l border-border pl-6">
      {steps.map((s) => (
        <li key={s.key} className="relative" aria-current={s.state === "current" ? "step" : undefined}>
          <span
            aria-hidden="true"
            className={cn(
              "absolute -left-[31px] grid size-4 place-items-center rounded-full border-2 bg-background",
              s.state === "done" && "border-primary bg-primary",
              s.state === "current" && "border-primary",
              (s.state === "pending" || s.state === "skipped") && "border-border",
            )}
          >
            {s.state === "done" && <Check className="size-2.5 text-primary-foreground" />}
          </span>
          <p className={cn("text-sm font-medium", (s.state === "pending" || s.state === "skipped") && "text-muted-foreground", s.state === "skipped" && "line-through")}>{s.label}</p>
          {s.at && <p className="text-xs text-muted-foreground">{s.at}</p>}
          {s.note && <p className="mt-1 text-sm text-muted-foreground">{s.note}</p>}
        </li>
      ))}
    </ol>
  );
}

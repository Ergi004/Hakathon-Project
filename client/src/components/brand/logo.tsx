import { cn } from "@/lib/utils";

/** Abstract shield with a check mark cut out by a scan line. Original artwork. */
export function LogoMark({ className, animated = false }: { className?: string; animated?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden="true" focusable="false">
      <defs>
        <clipPath id="mbr-shield">
          <path d="M16 2.5 4.5 7v8.2c0 7 4.9 12.5 11.5 14.3 6.6-1.8 11.5-7.3 11.5-14.3V7L16 2.5Z" />
        </clipPath>
      </defs>
      <path
        d="M16 2.5 4.5 7v8.2c0 7 4.9 12.5 11.5 14.3 6.6-1.8 11.5-7.3 11.5-14.3V7L16 2.5Z"
        className="fill-primary"
      />
      <path
        d="m10.5 16.2 3.9 3.8 7.4-8"
        fill="none"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-primary-foreground"
      />
      <g clipPath="url(#mbr-shield)">
        <rect
          x="2"
          y="15"
          width="28"
          height="1.2"
          className={cn("fill-primary-foreground/50", animated && "animate-scan-line")}
        />
      </g>
    </svg>
  );
}

export function Logo({ className, label }: { className?: string; label: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className="font-display text-lg font-bold tracking-tight">{label}</span>
    </span>
  );
}

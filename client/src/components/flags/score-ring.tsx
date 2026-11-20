import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { FLAG_STYLES, type FlagLevel } from "@/lib/flags";
import { FlagIcon } from "./flag-icon";

const SIZES = {
  sm: { px: 56, stroke: 5, text: "text-base", icon: "size-3" },
  md: { px: 112, stroke: 8, text: "text-3xl", icon: "size-4" },
  lg: { px: 176, stroke: 10, text: "text-5xl", icon: "size-5" },
} as const;

/** SVG ring 0-100 in the flag colour with the number in the centre (SPEC 3). */
export function ScoreRing({
  score,
  flag,
  size = "md",
  glow = false,
  className,
}: {
  score: number | null;
  flag: FlagLevel;
  size?: keyof typeof SIZES;
  glow?: boolean;
  className?: string;
}) {
  const t = useTranslations("flags");
  const { px, stroke, text, icon } = SIZES[size];
  const r = (px - stroke) / 2;
  const c = 2 * Math.PI * r;
  const value = flag === "grey" || score === null ? 0 : Math.max(0, Math.min(100, Math.round(score)));
  const offset = c * (1 - value / 100);
  const label = flag === "grey" || score === null ? t("grey") : `${t(flag)}. ${t("score", { score: value })}`;

  return (
    <div
      role="img"
      aria-label={label}
      className={cn("relative inline-grid place-items-center", className)}
      style={{ width: px, height: px }}
    >
      {glow && (
        <div
          aria-hidden="true"
          className={cn("absolute inset-2 rounded-full opacity-40 blur-xl", FLAG_STYLES[flag].bg)}
        />
      )}
      <svg width={px} height={px} viewBox={`0 0 ${px} ${px}`} className="-rotate-90" aria-hidden="true">
        <circle cx={px / 2} cy={px / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-muted" />
        <circle
          cx={px / 2}
          cy={px / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className={cn(FLAG_STYLES[flag].stroke, "motion-safe:[animation:ring-sweep_900ms_ease-out_both]")}
          style={{ ["--ring-circumference" as string]: c }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center" aria-hidden="true">
        <div className="flex flex-col items-center leading-none">
          <span className={cn("font-display font-bold tabular-nums", text)}>
            {flag === "grey" || score === null ? "–" : value}
          </span>
          {size !== "sm" && <FlagIcon flag={flag} className={cn("mt-1", icon, FLAG_STYLES[flag].text)} />}
        </div>
      </div>
    </div>
  );
}

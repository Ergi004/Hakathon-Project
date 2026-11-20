import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { FLAG_STYLES, type FlagLevel } from "@/lib/flags";
import { FlagIcon } from "./flag-icon";

/** Pill with icon, word and score. Colour is never the only signal (SPEC 3). */
export function FlagBadge({
  flag,
  score,
  className,
}: {
  flag: FlagLevel;
  score?: number | null;
  className?: string;
}) {
  const t = useTranslations("flags");
  const s = FLAG_STYLES[flag];
  const showScore = flag !== "grey" && typeof score === "number";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        s.bg,
        s.border,
        "text-foreground",
        className,
      )}
    >
      <FlagIcon flag={flag} className={cn("size-3.5 shrink-0", s.text)} />
      <span>{t(flag)}</span>
      {showScore && (
        <>
          <span aria-hidden="true" className="text-muted-foreground">·</span>
          <span className="font-mono tabular-nums" aria-label={t("score", { score })}>
            {score}
          </span>
        </>
      )}
    </span>
  );
}

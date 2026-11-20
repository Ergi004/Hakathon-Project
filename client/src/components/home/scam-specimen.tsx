import { getTranslations } from "next-intl/server";
import type { CSSProperties, ReactNode } from "react";
import { FlagBadge } from "@/components/flags/flag-badge";
import { cn } from "@/lib/utils";

const NOTES = ["pay", "urgent", "link"] as const;
/** Each mark draws in, then its note appears: one short sequence on load. */
const delay = (i: number): CSSProperties => ({ animationDelay: `${500 + i * 350}ms` });

/** Highlighted phrase tied to its numbered note. The underline colour carries severity. */
function Mark({ n, children, className }: { n: number; children: ReactNode; className?: string }) {
  return (
    <mark className={cn("bg-transparent text-inherit", className)}>
      <span className="specimen-mark" style={delay(n - 1)}>
        <span className="text-foreground">{children}</span>
      </span>
      <sup className="ml-0.5 inline-block font-sans text-[0.65rem] font-semibold text-flag-red">{n}</sup>
    </mark>
  );
}

/** Hero illustration: a fake parcel SMS with the signals Mburoja flags (all synthetic, defanged). */
export async function ScamSpecimen() {
  const t = await getTranslations("home.specimen");
  return (
    <figure aria-label={t("label")} className="relative mx-auto w-full max-w-md lg:max-w-none">
      {/* Two faded messages behind it read as a phone's notification stack. */}
      <div aria-hidden="true" className="absolute inset-x-10 -top-6 h-16 rounded-[1.75rem] border border-border bg-card/40" />
      <div aria-hidden="true" className="absolute inset-x-5 -top-3 h-16 rounded-[1.9rem] border border-border bg-card/70" />

      <div className="relative rounded-[2rem] border border-border bg-card p-5 shadow-[0_30px_80px_-40px_oklch(0_0_0/0.5)] sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-muted font-display text-sm font-bold text-muted-foreground" aria-hidden="true">P</span>
            <div className="leading-tight">
              <p className="font-medium">{t("sender")}</p>
              <p className="text-xs text-muted-foreground">{t("received")}</p>
            </div>
          </div>
          <span className="specimen-note" style={delay(3)}><FlagBadge flag="red" score={72} /></span>
        </div>

        <p className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3 text-[0.95rem] leading-relaxed break-words">
          {t.rich("body", {
            pay: (c) => <Mark n={1} className="text-flag-orange">{c}</Mark>,
            urgent: (c) => <Mark n={2} className="text-flag-orange">{c}</Mark>,
            link: (c) => <Mark n={3} className="font-mono text-[0.85rem] text-flag-red">{c}</Mark>,
          })}
        </p>

        <ol className="mt-5 space-y-2.5">
          {NOTES.map((k, i) => (
            <li key={k} className="specimen-note flex items-start gap-3 text-sm" style={delay(i + 0.6)}>
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-flag-red/15 text-[0.7rem] font-semibold text-flag-red" aria-hidden="true">{i + 1}</span>
              <span>{t(`notes.${k}`)}</span>
            </li>
          ))}
        </ol>
      </div>
      <figcaption className="mt-4 text-center text-sm text-muted-foreground lg:text-left">{t("caption")}</figcaption>
    </figure>
  );
}

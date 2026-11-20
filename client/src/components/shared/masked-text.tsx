import { Fragment } from "react";
import { cn } from "@/lib/utils";

const TOKEN = /(\[(?:EMAIL|IBAN|CARD|PHONE|ID|NAME)\])/g;

/** Masked message text: mask tokens as chips, trigger phrases highlighted (SPEC 3). */
export function MaskedText({ text, highlights = [], className }: { text: string; highlights?: string[]; className?: string }) {
  const hl = highlights.filter((h) => h && h.length > 2).map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const hlRe = hl.length ? new RegExp(`(${hl.join("|")})`, "gi") : null;

  return (
    <p className={cn("text-sm leading-relaxed break-words whitespace-pre-wrap", className)}>
      {text.split(TOKEN).map((part, i) =>
        TOKEN.test(part) ? (
          <span key={i} className="mx-0.5 inline-flex rounded-full border border-border bg-muted px-1.5 font-mono text-[0.75em] text-muted-foreground">
            {part.slice(1, -1).toLowerCase()}
          </span>
        ) : hlRe ? (
          <Fragment key={i}>
            {part.split(hlRe).map((p, j) =>
              j % 2 === 1 ? (
                <mark key={j} className="rounded bg-flag-orange/25 px-0.5 text-foreground">
                  {p}
                </mark>
              ) : (
                <Fragment key={j}>{p}</Fragment>
              ),
            )}
          </Fragment>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </p>
  );
}

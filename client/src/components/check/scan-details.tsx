"use client";

import {
  AtSign, BadgeCheck, CircleHelp, ExternalLink, Fingerprint, Globe, Link2, Mail, MessageSquareText, Network, PencilLine, Phone, QrCode,
  ScanText, ShieldAlert, ShieldX, TriangleAlert, type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { CampaignStatusBadge } from "@/components/shared/campaign-status";
import { DefangedText } from "@/components/shared/defanged-text";
import { SeverityDot } from "@/components/shared/severity-dot";
import { Link } from "@/i18n/navigation";
import { fmtDate } from "@/lib/format";
import { asBrandCategory, asScamType } from "@/lib/pattern-labels";
import { cn } from "@/lib/utils";
import type { CheckOutcome } from "@/server/checks";
import type { IndicatorLevel } from "@/server/detection/indicators";

/** Icon, word and colour per indicator level: colour is never the only signal. */
const LEVEL: Record<IndicatorLevel, { icon: LucideIcon; tone: string; bar: string }> = {
  official: { icon: BadgeCheck, tone: "border-flag-green/40 bg-flag-green/12 [&>svg]:text-flag-green", bar: "bg-flag-green" },
  no_signals: { icon: CircleHelp, tone: "border-border bg-muted [&>svg]:text-muted-foreground", bar: "bg-muted-foreground/40" },
  low: { icon: CircleHelp, tone: "border-flag-yellow/50 bg-flag-yellow/12 [&>svg]:text-flag-yellow", bar: "bg-flag-yellow" },
  suspicious: { icon: TriangleAlert, tone: "border-flag-orange/50 bg-flag-orange/14 [&>svg]:text-flag-orange", bar: "bg-flag-orange" },
  high: { icon: ShieldAlert, tone: "border-flag-red/40 bg-flag-red/12 [&>svg]:text-flag-red", bar: "bg-flag-red" },
  malicious: { icon: ShieldX, tone: "border-flag-darkred/50 bg-flag-darkred/15 [&>svg]:text-flag-darkred", bar: "bg-flag-darkred" },
};
const SEVERITY_EDGE = { critical: "border-l-flag-darkred", high: "border-l-flag-red", medium: "border-l-flag-orange", low: "border-l-flag-yellow" } as const;
const KIND_ICON = { email: Mail, message: MessageSquareText, link: Link2, phone: Phone, qr: QrCode } as const;

function LevelBadge({ level }: { level: IndicatorLevel }) {
  const t = useTranslations("scan.level");
  const { icon: Icon, tone } = LEVEL[level];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap [&>svg]:size-3.5", tone)}>
      <Icon aria-hidden="true" />
      {t(level)}
    </span>
  );
}

function Section({ icon: Icon, title, children, aside }: { icon: LucideIcon; title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card/60 p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-2 font-display text-lg font-medium">
          <Icon className="size-5 text-primary" aria-hidden="true" />
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Everything the scan found: what was read, the campaign, the pattern, and each indicator's risk. */
export function ScanDetails({ outcome, onEditTranscript }: { outcome: CheckOutcome; onEditTranscript?: () => void }) {
  const t = useTranslations("scan");
  const tScam = useTranslations("scamType");
  const tBrand = useTranslations("brandCategory");
  const tSignal = useTranslations("signalCode");
  const locale = useLocale() as "sq" | "en";
  const { detected, campaign, result } = outcome;
  const ind = result.indicators;
  const urlCount = ind.domains.reduce((n, d) => n + d.urls.length, 0);
  const KindIcon = KIND_ICON[detected.kind];
  const scamKey = asScamType(result.classification.scamType);
  const brandKey = asBrandCategory(result.classification.impersonatedBrand);
  const signals = result.classification.matchedSignals;
  const recognised = (scamKey && scamKey !== "other") || signals.length > 0;
  const reasonText = (code: string) => {
    const r = result.reasons.find((x) => x.code === code);
    return r ? (locale === "en" ? r.text_en : r.text_sq) : null;
  };

  const shot = detected.screenshot;

  return (
    <div className="space-y-4">
      {/* What image recognition read from a screenshot: shown so the citizen can check it */}
      {shot && (
        <Section
          icon={ScanText}
          title={t("shot.title")}
          aside={onEditTranscript && shot.body ? (
            <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={onEditTranscript}>
              <PencilLine className="size-3.5" aria-hidden="true" />{t("shot.edit")}
            </Button>
          ) : undefined}
        >
          <p className="text-xs text-muted-foreground">{t(`shot.kind.${shot.messageKind}`)} · {t("shot.hint")}</p>
          {(shot.sender || shot.subject) && (
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              {shot.sender && <div className="rounded-xl bg-muted/50 px-3 py-2"><dt className="text-xs text-muted-foreground">{t("from")}</dt><dd className="font-medium break-words">{shot.sender}</dd></div>}
              {shot.subject && <div className="rounded-xl bg-muted/50 px-3 py-2"><dt className="text-xs text-muted-foreground">{t("subject")}</dt><dd className="font-medium break-words">{shot.subject}</dd></div>}
            </dl>
          )}
          {shot.body && (
            <blockquote className="max-h-56 overflow-auto rounded-xl border border-border bg-background/60 p-3 text-sm leading-relaxed whitespace-pre-wrap">
              {/* Links arrive defanged from the server, as everywhere else. */}
              {shot.body}
            </blockquote>
          )}
          <div className="flex flex-wrap gap-2 text-xs">
            {shot.brands.length > 0 && (
              <span className="inline-flex flex-wrap items-center gap-1.5 rounded-full border border-border bg-background/60 px-2.5 py-1" title={t("shot.brandsNote")}>
                <span className="text-muted-foreground">{t("shot.brands")}:</span> <span className="font-medium">{shot.brands.join(", ")}</span>
              </span>
            )}
            {shot.hasQrCode && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-2.5 py-1">
                <QrCode className="size-3.5 text-primary" aria-hidden="true" />{shot.qrLinks.length ? t("shot.qrRead", { count: shot.qrLinks.length }) : t("shot.qrSeen")}
              </span>
            )}
          </div>
          {shot.brands.length > 0 && <p className="text-xs text-muted-foreground">{t("shot.brandsNote")}</p>}
        </Section>
      )}

      {/* What was scanned */}
      <section aria-label={t("readTitle")} className="flex flex-col gap-3 rounded-2xl border border-border bg-card/60 p-4 sm:flex-row sm:items-center sm:justify-between md:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><KindIcon className="size-5" aria-hidden="true" /></span>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{t("readAs")}</p>
            <p className="font-medium">{t(`kind.${detected.kind}`)}</p>
            {(detected.sender || detected.subject) && (
              <p className="truncate text-sm text-muted-foreground">
                {detected.sender && <>{t("from")} <span className="text-foreground">{detected.sender}</span></>}
                {detected.sender && detected.subject && " · "}
                {detected.subject && <>{t("subject")} <span className="text-foreground">“{detected.subject}”</span></>}
              </p>
            )}
          </div>
        </div>
        <ul className="flex flex-wrap gap-2 text-xs">
          {([
            [Globe, t("counts.domains", { count: ind.domains.length })],
            [Link2, t("counts.links", { count: urlCount })],
            [Phone, t("counts.phones", { count: ind.phones.length })],
            [AtSign, t("counts.emails", { count: ind.emails.length })],
          ] as const).map(([Icon, label]) => (
            <li key={label} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-2.5 py-1">
              <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />{label}
            </li>
          ))}
        </ul>
      </section>

      {/* Campaign */}
      {campaign ? (
        <section className={cn("space-y-3 rounded-2xl border border-l-4 border-border bg-card/60 p-4 md:p-5", SEVERITY_EDGE[campaign.severity])}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="inline-flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                <Network className="size-3.5" aria-hidden="true" />
                {campaign.matchType === "known" ? t("campaign.known") : t("campaign.similar", { pct: Math.round(campaign.confidence * 100) })}
              </p>
              <h3 className="font-display text-xl font-semibold">{campaign.name ?? campaign.code}</h3>
              <p className="text-sm text-muted-foreground">
                <span className="font-mono">{campaign.code}</span> · <span className="capitalize">{campaign.tactic.replace(/_/g, " ")}</span>
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <CampaignStatusBadge status={campaign.status} />
              <span className="inline-flex items-center gap-1.5 text-xs">{t("campaign.severity")}: <SeverityDot severity={campaign.severity} className="font-medium" /></span>
            </div>
          </div>
          <p className="text-sm">
            {t("campaign.stats", { count: campaign.messageCount, since: fmtDate(campaign.firstSeen, locale), last: fmtDate(campaign.lastSeen, locale) })}
          </p>
          <p className="text-sm text-muted-foreground">{t(`campaign.meaning.${campaign.status}`)}</p>
          {campaign.isPublic && (
            <Link href={`/threats/${encodeURIComponent(campaign.code)}`} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              {t("campaign.open")} <ExternalLink className="size-3.5" aria-hidden="true" />
            </Link>
          )}
        </section>
      ) : (
        result.flag !== "grey" && (
          <p className="flex items-start gap-2 rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            <Network className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {t("campaign.none")}
          </p>
        )
      )}

      {/* Pattern recognition */}
      {result.flag !== "grey" && detected.kind !== "phone" && (
        <Section icon={Fingerprint} title={t("pattern.title")}>
          {recognised ? (
            <div className="space-y-3">
              <dl className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-muted/50 p-3"><dt className="text-xs text-muted-foreground">{t("pattern.type")}</dt><dd className="font-medium">{scamKey ? tScam(scamKey) : "—"}</dd></div>
                <div className="rounded-xl bg-muted/50 p-3"><dt className="text-xs text-muted-foreground">{t("pattern.brand")}</dt><dd className="font-medium">{brandKey ? tBrand(brandKey) : "—"}</dd></div>
                <div className="rounded-xl bg-muted/50 p-3">
                  <dt className="text-xs text-muted-foreground">{t("pattern.confidence")}</dt>
                  <dd className="flex items-center gap-2 font-medium tabular-nums">
                    {Math.round(result.classification.confidence * 100)}%
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-background" aria-hidden="true">
                      <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.round(result.classification.confidence * 100)}%` }} />
                    </span>
                  </dd>
                </div>
              </dl>
              {signals.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {signals.map((s, i) => (
                    <li key={`${s.code}-${i}`} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-background/60 px-2.5 py-1 text-xs">
                      <span className="font-medium">{tSignal(s.code)}</span>
                      {s.evidence && <span className="truncate text-muted-foreground">“{s.evidence.replace(/^[a-z_]+:(?!\/\/)/i, "").replace(/^https?:\/\//, "").replace(/(?<!\[)\.(?!\])/g, "[.]")}”</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("pattern.none")}</p>
          )}
        </Section>
      )}

      {/* Domains and links */}
      {ind.domains.length > 0 && (
        <Section icon={Globe} title={t("domains.title")} aside={<span className="text-xs text-muted-foreground">{t("domains.hint")}</span>}>
          <ul className="space-y-3">
            {ind.domains.map((d) => (
              <li key={d.value} className="space-y-2.5 rounded-xl border border-border bg-background/60 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <DefangedText value={d.value} />
                  <LevelBadge level={d.level} />
                </div>
                {d.level !== "official" && (
                  <div className="flex items-center gap-3">
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted" role="img" aria-label={t("domains.risk", { risk: d.risk })}>
                      <span className={cn("block h-full rounded-full", LEVEL[d.level].bar)} style={{ width: `${Math.max(3, d.risk)}%` }} />
                    </span>
                    <span className="w-24 text-right text-xs text-muted-foreground tabular-nums">{t("domains.risk", { risk: d.risk })}</span>
                  </div>
                )}
                <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {d.lookalike && <li>{t("domains.imitates", { target: d.lookalike.imitates })} · {t(`domains.cls.${d.lookalike.cls}`)}</li>}
                  {d.ageDays !== null && <li>{t("domains.age", { count: d.ageDays })}</li>}
                  {d.hostingCountry && <li>{t("domains.hosting", { country: d.hostingCountry })}</li>}
                  {d.campaignCode && <li className="font-medium text-flag-red">{t("domains.inCampaign", { code: d.campaignCode })}</li>}
                  {d.level === "no_signals" && <li>{t("domains.unverified")}</li>}
                </ul>
                {d.signals.length > 0 && (
                  <ul className="space-y-1 border-t border-border pt-2 text-sm">
                    {d.signals.map((code) => reasonText(code)).filter(Boolean).map((text) => (
                      <li key={text} className="flex gap-2"><TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-flag-orange" aria-hidden="true" />{text}</li>
                    ))}
                  </ul>
                )}
                {d.urls.length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">{t("domains.links", { count: d.urls.length })}</summary>
                    <ul className="mt-2 space-y-1 font-mono break-all">
                      {d.urls.map((u) => <li key={u}>{u}</li>)}
                    </ul>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Phone numbers and email addresses */}
      {(ind.phones.length > 0 || ind.emails.length > 0) && (
        <Section icon={Phone} title={t("contacts.title")}>
          <ul className="grid gap-2 sm:grid-cols-2">
            {[...ind.phones.map((c) => ({ ...c, icon: Phone })), ...ind.emails.map((c) => ({ ...c, icon: AtSign }))].map((c) => (
              <li key={c.value} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background/60 px-3 py-2 text-sm">
                <span className="inline-flex min-w-0 items-center gap-2 font-mono text-xs"><c.icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" /><span className="truncate">{c.value}</span></span>
                <LevelBadge level={c.level} />
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

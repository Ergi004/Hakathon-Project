import { Bot, ExternalLink, Fingerprint, Globe, Lightbulb, MapPin, Send, ShieldAlert, Target } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { z } from "zod";
import { FlagBadge } from "@/components/flags/flag-badge";
import { ScoreRing } from "@/components/flags/score-ring";
import { EmptyState } from "@/components/layout/empty-state";
import { DefangedText } from "@/components/shared/defanged-text";
import { IocTable } from "@/components/shared/ioc-table";
import { ReasonList } from "@/components/shared/reason-list";
import { IntelLive } from "@/components/soc/intel-live";
import { LandingPanel, type LandingCandidate } from "@/components/soc/landing-panel";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { flagForScore } from "@/lib/flags";
import { fmtAgo, fmtDateTime } from "@/lib/format";
import { requireRole } from "@/server/auth";
import type { Reason } from "@/server/detection/types";
import { landingBlock, urlscanConfig } from "@/server/phishing-intel/sandbox/landing-service";
import { landingKey, sanitizeForSandbox } from "@/server/phishing-intel/sandbox/sanitize";
import { getIntelScan } from "@/server/queries/intel";
import { BackLink } from "@/components/layout/back-link";

type Params = Promise<{ locale: string; id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id, locale } = await params;
  return { title: `${(await getTranslations({ locale: locale as "sq" | "en", namespace: "soc.nav" }))("intel")} · ${id.slice(0, 8)}` };
}

const Section = ({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) => (
  <section className="glass-card space-y-3 rounded-xl p-4">
    <h2 className="inline-flex items-center gap-2 font-display text-base font-medium">{icon}{title}</h2>
    {children}
  </section>
);

async function Workspace({ params }: { params: Params }) {
  const { id } = await params;
  const t = await getTranslations("soc.intel");
  const tc = await getTranslations("channel");
  const locale = await getLocale();
  if (!z.uuid().safeParse(id).success) return <EmptyState title={t("notFound")} />;
  const ctx = await requireRole("soc_analyst");
  const d = await getIntelScan(ctx.supabase, id);
  if (!d) return <EmptyState title={t("notFound")} />;
  const { scan: s, report: r, events, related, landing } = d;
  const usc = urlscanConfig();
  const candidates: LandingCandidate[] = d.landingCandidates.map((u) => {
    const sz = sanitizeForSandbox(u);
    const a = sz ? landing.find((x) => x.url_key === landingKey(sz.url)) : undefined;
    return {
      url: u,
      shown: sz?.url ?? u,
      replaced: sz?.replaced ?? [],
      block: landingBlock(u),
      state: !a ? "none" : a.status === "completed" ? "completed" : a.status === "failed" ? "failed" : "pending",
    };
  });
  const done = s.status === "completed" || s.status === "partial";
  const flag = done && s.risk_score !== null ? flagForScore(s.risk_score) : "grey";
  // Dynamic keys (codes from the engine) fall back to the raw code when no translation exists.
  const tx = (key: string, fallback: string): string => (t.has(key as never) ? t(key as never) : fallback);
  const label = (ns: "type" | "family", v: string) => tx(`${ns}.${v}`, v);
  const lang = locale === "sq" ? "sq" : "en";

  const reasons: Reason[] = (r?.evidence.engineReasons ?? []).map((x) => ({ ...x, evidence: x.evidence ?? undefined }));
  const email = r && "email" in r.evidence ? r.evidence.email : null;
  const sms = r && "sms" in r.evidence ? r.evidence.sms : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-4">
          <ScoreRing score={done ? s.risk_score : null} flag={flag} size="sm" />
          <div>
            <p className="font-mono text-sm">{s.id.slice(0, 8)}</p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <FlagBadge flag={flag} score={done ? s.risk_score : null} />
              <Badge variant="outline">{t(`verdict.${s.verdict as "unknown"}`)}</Badge>
              <Badge variant="secondary">{tc(s.channel as "sms" | "email")}</Badge>
              {s.severity && <Badge variant="outline">{t(`severity.${s.severity as "low"}`)}</Badge>}
              {s.albania && <Badge variant="outline" className="gap-1"><MapPin className="size-3" aria-hidden="true" />{t("albania")}</Badge>}
              {s.vt_max_malicious !== null && s.vt_max_malicious > 0 && <Badge variant="destructive">{t("vtBadge", { n: s.vt_max_malicious })}</Badge>}
            </div>
            <p className="pt-1 text-xs text-muted-foreground">{fmtDateTime(s.created_at, locale)} · {t("source")}: {s.source} · {t(`status.${s.status as "queued"}`)}</p>
          </div>
        </div>
        <IntelLive scanId={s.id} />
      </div>

      {!done && (
        <Section title={t("processing")}>
          <Progress value={s.progress} aria-label={t("processing")} />
          <ul className="flex flex-wrap gap-2 text-xs">
            {Object.entries((s.stages ?? {}) as Record<string, string>).map(([k, v]) => (
              <li key={k}><Badge variant={v === "completed" ? "secondary" : "outline"}>{tx(`stage.${k}`, k)}: {v}</Badge></li>
            ))}
          </ul>
        </Section>
      )}

      {done && !r && <EmptyState title={t("noReport")} />}

      {r && (
        <Section title={t("exfil.title")} icon={<Send className="size-4 text-flag-red" aria-hidden="true" />}>
          {r.exfil?.endpoints.length ? (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("exfil.col.kind")}</TableHead>
                      <TableHead>{t("exfil.col.destination")}</TableHead>
                      <TableHead>{t("exfil.col.foundIn")}</TableHead>
                      <TableHead>{t("exfil.col.vt")}</TableHead>
                      <TableHead>{t("exfil.col.otherScans")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {r.exfil.endpoints.map((e) => {
                      const rel = related[e.key];
                      return (
                        <TableRow key={e.key}>
                          <TableCell className="whitespace-nowrap text-sm font-medium">{tx(`exfil.kind.${e.kind}`, e.kind)}</TableCell>
                          <TableCell className="max-w-80">
                            <DefangedText value={e.value} revealable={false} />
                            {e.chatId && <p className="pt-0.5 font-mono text-xs text-muted-foreground">{t("exfil.chat")}: {e.chatId}</p>}
                            {e.method && <span className="text-xs text-muted-foreground">{e.method} </span>}
                            {e.via !== "plain" && <Badge variant="outline" className="ml-1 text-xs">{tx(`exfil.via.${e.via}`, e.via)}</Badge>}
                          </TableCell>
                          <TableCell className="text-xs">
                            {tx(`exfil.source.${e.source}`, e.source)}
                            {e.origin && <span className="block font-mono text-muted-foreground">{e.origin}</span>}
                          </TableCell>
                          <TableCell className="text-xs tabular-nums">
                            {!e.host ? <span className="text-muted-foreground">{t("exfil.sharedService")}</span>
                              : !e.reputation ? "—"
                              : !e.reputation.found ? <span className="text-muted-foreground">{t("vt.notFound")}</span>
                              : <span className={e.reputation.malicious > 0 ? "font-medium text-flag-red" : "text-flag-green"}>{t("engines", { n: e.reputation.malicious })}</span>}
                          </TableCell>
                          <TableCell className="text-xs">
                            {rel?.scans ? (
                              <>
                                <span className="font-medium text-flag-red">{t("exfil.otherScansN", { n: rel.scans })}</span>
                                <span className="flex flex-wrap gap-1 pt-1">
                                  {rel.latest.map((x) => <Link key={x.id} href={`/soc/intel/${x.id}`} className="font-mono underline-offset-2 hover:underline">{x.id.slice(0, 8)}</Link>)}
                                </span>
                              </>
                            ) : <span className="text-muted-foreground">{t("exfil.firstSeen")}</span>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground">{t("exfil.note")}</p>
              {r.exfil.endpoints.some((e) => e.kind === "telegram_bot" || e.kind === "discord_webhook" || e.kind === "webhook") && (
                <p className="text-xs text-muted-foreground">{t("exfil.abuseHint")}</p>
              )}
            </>
          ) : <p className="text-sm text-muted-foreground">{t("exfil.none")}</p>}
        </Section>
      )}

      <Section title={t("landing.title")} icon={<Globe className="size-4" aria-hidden="true" />}>
        <p className="text-xs text-muted-foreground">{t("landing.intro")}</p>
        <LandingPanel scanId={s.id} configured={Boolean(usc.apiKey)} visibility={usc.visibility} candidates={candidates} />
        {landing.map((a) => {
          const page = (a.page ?? {}) as Record<string, string | number | null>;
          const verdict = (a.verdict ?? {}) as { score?: number | null; malicious?: boolean; brands?: string[] };
          const forms = (a.forms ?? []) as { action: string; method: string; password: boolean; inputs: string[] }[];
          const exfil = (a.exfil ?? []) as { kind: string; key: string; display: string; origin?: string; via: string; chatId?: string }[];
          const req = (a.requests ?? {}) as { total?: number; domains?: string[]; posts?: { method: string; url: string }[]; redirects?: string[] };
          const rep = (a.reputation ?? []) as { type: string; value: string; found: boolean; malicious: number }[];
          return (
            <article key={a.id} className="space-y-3 rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={a.status === "failed" ? "destructive" : "outline"}>{tx(`landing.status.${a.status}`, a.status)}</Badge>
                  {a.status === "completed" &&
                    (verdict.malicious ? (
                      <Badge variant="destructive">
                        {t("landing.malicious")}
                        {verdict.score !== null && verdict.score !== undefined ? ` · ${verdict.score}` : ""}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">{t("landing.notMalicious")}</Badge>
                    ))}
                  {(verdict.brands ?? []).slice(0, 3).map((b) => (
                    <Badge key={b} variant="outline">{b}</Badge>
                  ))}
                  <span className="text-xs text-muted-foreground">{fmtAgo(a.created_at, locale)} · {a.visibility}</span>
                </div>
                <span className="flex gap-3 text-xs">
                  {a.result_url && (
                    <a href={a.result_url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 underline-offset-2 hover:underline">
                      <ExternalLink className="size-3" aria-hidden="true" />
                      {t("landing.openReport")}
                    </a>
                  )}
                  {a.screenshot_url && a.status === "completed" && (
                    <a href={a.screenshot_url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 underline-offset-2 hover:underline">
                      <ExternalLink className="size-3" aria-hidden="true" />
                      {t("landing.screenshot")}
                    </a>
                  )}
                </span>
              </div>
              <div className="text-xs">
                <span className="text-muted-foreground">{t("landing.submittedUrl")}: </span>
                <DefangedText value={a.url} revealable={false} />
              </div>
              {a.status === "submitted" || a.status === "queued" ? <p className="text-sm text-muted-foreground" role="status">{t("landing.pendingNote")}</p> : null}
              {a.status === "failed" && <p className="text-sm text-destructive">{a.error}</p>}
              {a.status === "completed" && (
                <>
                  {a.final_url && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">{t("landing.finalUrl")}: </span>
                      <DefangedText value={a.final_url} revealable={false} />
                    </div>
                  )}
                  <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2 lg:grid-cols-4">
                    {(["title", "ip", "asnname", "country", "server", "status", "domainAgeDays", "tlsIssuer"] as const).map((k) =>
                      page[k] !== null && page[k] !== undefined && page[k] !== "" ? (
                        <div key={k} className="min-w-0">
                          <dt className="inline text-muted-foreground">{tx(`landing.page.${k}`, k)}: </dt>
                          <dd className="inline break-words font-mono">{String(page[k])}</dd>
                        </div>
                      ) : null,
                    )}
                  </dl>

                  <div>
                    <h3 className="pb-1 text-sm font-medium">{t("landing.forms")}</h3>
                    {forms.length ? (
                      <ul className="space-y-1 text-xs">
                        {forms.map((f, i) => (
                          <li key={i} className="flex flex-wrap items-center gap-2">
                            <Badge variant={f.password ? "destructive" : "outline"}>{f.password ? t("landing.passwordForm") : f.method}</Badge>
                            {f.action ? <DefangedText value={f.action} revealable={false} /> : <span className="text-muted-foreground">{t("landing.sameUrl")}</span>}
                            {f.inputs.length > 0 && <span className="font-mono text-muted-foreground">[{f.inputs.join(", ")}]</span>}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground">{t("landing.noForms")}</p>
                    )}
                  </div>

                  <div>
                    <h3 className="inline-flex items-center gap-1 pb-1 text-sm font-medium">
                      <Send className="size-3.5 text-flag-red" aria-hidden="true" />
                      {t("exfil.title")}
                    </h3>
                    {exfil.length ? (
                      <ul className="space-y-1.5 text-xs">
                        {exfil.map((e) => (
                          <li key={e.key} className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{tx(`exfil.kind.${e.kind}`, e.kind)}</span>
                            <DefangedText value={e.display} revealable={false} />
                            {e.chatId && <span className="font-mono text-muted-foreground">{t("exfil.chat")}: {e.chatId}</span>}
                            {e.via !== "plain" && <Badge variant="outline">{tx(`exfil.via.${e.via}`, e.via)}</Badge>}
                            {e.origin && <span className="text-muted-foreground">{e.origin}</span>}
                            {related[e.key]?.scans ? <span className="font-medium text-flag-red">{t("exfil.otherScansN", { n: related[e.key].scans })}</span> : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground">{t("landing.noExfil")}</p>
                    )}
                  </div>

                  <div className="grid gap-3 text-xs md:grid-cols-2">
                    <div>
                      <h3 className="pb-1 text-sm font-medium">{t("landing.requests", { n: req.total ?? 0 })}</h3>
                      {(req.posts ?? []).length > 0 && (
                        <ul className="space-y-0.5">
                          {(req.posts ?? []).map((x, i) => (
                            <li key={i}>
                              <span className="font-mono">{x.method}</span> <DefangedText value={x.url} revealable={false} />
                            </li>
                          ))}
                        </ul>
                      )}
                      {(req.redirects ?? []).length > 0 && <p className="pt-1 text-muted-foreground">{t("landing.redirects", { n: (req.redirects ?? []).length })}</p>}
                      <p className="flex flex-wrap gap-1 pt-1">
                        {(req.domains ?? []).slice(0, 15).map((dmn) => (
                          <span key={dmn} className="rounded border border-border px-1 font-mono">{dmn.split(".").join("[.]")}</span>
                        ))}
                      </p>
                    </div>
                    <div>
                      <h3 className="pb-1 text-sm font-medium">VirusTotal</h3>
                      {rep.length ? (
                        <ul className="space-y-0.5">
                          {rep.map((x) => (
                            <li key={x.value}>
                              <span className="font-mono">{x.value}</span> ·{" "}
                              {!x.found ? t("vt.notFound") : <span className={x.malicious ? "font-medium text-flag-red" : "text-flag-green"}>{t("engines", { n: x.malicious })}</span>}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-muted-foreground">{t("vt.none")}</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </article>
          );
        })}
      </Section>


      {r && (
        <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
          <div className="space-y-5">
            <Section title={t("message")}>
              {email && (
                <dl className="grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
                  <div><dt className="inline">{t("from")}: </dt><dd className="inline font-mono text-foreground">{email.from ?? "—"}</dd></div>
                  <div><dt className="inline">{t("replyTo")}: </dt><dd className="inline font-mono text-foreground">{email.replyTo ?? "—"}</dd></div>
                  <div className="sm:col-span-2"><dt className="inline">{t("subject")}: </dt><dd className="inline text-foreground">{email.subject ?? "—"}</dd></div>
                  <div className="sm:col-span-2">
                    <dt className="inline">{t("auth")}: </dt>
                    <dd className="inline font-mono text-foreground">SPF {email.authentication.spf} · DKIM {email.authentication.dkim} · DMARC {email.authentication.dmarc}{email.authentication.source === "absent" ? ` (${t("authAbsent")})` : ""}</dd>
                  </div>
                  {email.attachments.length > 0 && (
                    <div className="sm:col-span-2"><dt>{t("attachments")}:</dt>
                      <dd><ul className="space-y-0.5 pt-1">{email.attachments.map((a) => <li key={`${a.name}${a.sha256}`} className="font-mono text-foreground">{a.name} · {a.detectedType ?? a.mime}{a.sha256 ? ` · ${a.sha256.slice(0, 16)}…` : ""}</li>)}</ul></dd>
                    </div>
                  )}
                </dl>
              )}
              {sms && (
                <>
                  <dl className="grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
                    <div><dt className="inline">{t("sender")}: </dt><dd className="inline font-mono text-foreground">{sms.sender ?? "—"}</dd></div>
                    <div><dt className="inline">{t("senderKind")}: </dt><dd className="inline text-foreground">{tx(`senderKinds.${sms.senderKind}`, sms.senderKind)}{sms.internationalSender ? ` · ${t("international")}` : ""}</dd></div>
                  </dl>
                  <p className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-sm">{sms.excerpt}</p>
                </>
              )}
              {s.albania_signals.length > 0 && (
                <p className="text-xs text-muted-foreground">{t("albaniaWhy")}: {s.albania_signals.map((x) => tx(`albaniaSignal.${x}`, x)).join(" · ")}</p>
              )}
            </Section>

            <Section title={t("virusTotal")} icon={<ShieldAlert className="size-4" aria-hidden="true" />}>
              {r.reputation.results.length ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("vt.indicator")}</TableHead>
                        <TableHead className="text-right">{t("vt.malicious")}</TableHead>
                        <TableHead className="text-right">{t("vt.suspicious")}</TableHead>
                        <TableHead className="text-right">{t("vt.harmless")}</TableHead>
                        <TableHead>{t("vt.label")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {r.reputation.results.map((v) => (
                        <TableRow key={`${v.type}:${v.value}`}>
                          <TableCell className="max-w-64"><span className="text-xs text-muted-foreground">{v.type} </span><DefangedText value={v.value} revealable={false} /></TableCell>
                          <TableCell className={`text-right tabular-nums ${v.malicious > 0 ? "font-medium text-flag-red" : ""}`}>{v.found ? v.malicious : "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{v.found ? v.suspicious : "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{v.found ? v.harmless : "—"}</TableCell>
                          <TableCell className="text-xs">{!v.found ? t("vt.notFound") : v.threatLabel ?? v.categories.slice(0, 2).join(", ") ?? "—"}{v.cached ? ` · ${t("vt.cached")}` : ""}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : <p className="text-sm text-muted-foreground">{t("vt.none")}</p>}
              {r.reputation.skipped.length > 0 && (
                <ul className="space-y-0.5 text-xs text-muted-foreground">
                  {r.reputation.skipped.map((k) => <li key={`${k.type}:${k.value}`}><span className="font-mono">{k.value}</span> · {tx(`vt.skip.${k.reason}`, k.reason)}</li>)}
                </ul>
              )}
            </Section>

            <Section title={t("iocs")}>
              <IocTable filename={`intel-${s.id.slice(0, 8)}`} rows={r.iocs.map((i) => ({ type: i.type, value: i.value, campaign: r.attribution.campaign?.code ?? null }))} />
            </Section>

            <Section title={t("findings")}>
              {r.evidence.findings.length ? (
                <ul className="space-y-1.5 text-sm">
                  {r.evidence.findings.map((f) => (
                    <li key={f.code} className="flex justify-between gap-3">
                      <span>{tx(`finding.${f.code}`, f.detail)}{f.evidence ? <span className="font-mono text-xs text-muted-foreground"> · {f.evidence}</span> : null}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">+{f.weight}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted-foreground">{t("noFindings")}</p>}
            </Section>
          </div>

          <div className="space-y-5">
            <Section title={t("reasons")}>
              {reasons.length ? <ReasonList reasons={reasons} initial={8} showWeights /> : <p className="text-sm text-muted-foreground">{t("noFindings")}</p>}
            </Section>

            <Section title={t("classification")} icon={<Fingerprint className="size-4" aria-hidden="true" />}>
              <dl className="space-y-2 text-sm">
                {([["phishingType", r.classification.phishingType, "type"], ["phishingFamily", r.classification.phishingFamily, "family"], ["malwareFamily", r.classification.malwareFamily, null]] as const).map(([k, list, ns]) => (
                  <div key={k}>
                    <dt className="text-xs text-muted-foreground">{t(`cls.${k}`)}</dt>
                    <dd className="flex flex-wrap gap-1.5 pt-0.5">
                      {list.length ? list.map((c) => (
                        <Badge key={c.value} variant="outline" title={c.evidence.join("\n")}>{ns ? label(ns, c.value) : c.value} · {Math.round(c.confidence * 100)}%{c.source === "ai" ? " · AI" : ""}</Badge>
                      )) : <span className="text-muted-foreground">—</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            </Section>

            <Section title={t("mitre")} icon={<Target className="size-4" aria-hidden="true" />}>
              {r.mitreAttack.length ? (
                <ul className="space-y-2 text-sm">
                  {r.mitreAttack.map((m) => (
                    <li key={m.id}>
                      <a className="font-mono text-xs underline-offset-2 hover:underline" href={`https://attack.mitre.org/techniques/${m.id.replace(".", "/")}/`} target="_blank" rel="noreferrer noopener">{m.id}</a> {m.name}
                      <p className="text-xs text-muted-foreground">{m.tactic} · {m.observation}</p>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted-foreground">{t("noMitre")}</p>}
            </Section>

            <Section title={t("attribution")}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{t(`attr.${r.attribution.status}`)}</Badge>
                {r.attribution.actor && <Badge variant="secondary">{r.attribution.actor.name}</Badge>}
                {r.attribution.campaign && <Badge variant="outline" className="font-mono">{r.attribution.campaign.code}</Badge>}
              </div>
              <p className="text-sm">{r.attribution.assessment}</p>
              <p className="text-xs text-muted-foreground">{r.attribution.uncertainty}</p>
            </Section>

            <Section title={t("ai")} icon={<Bot className="size-4" aria-hidden="true" />}>
              {r.ai?.output ? (
                <>
                  <p className="text-sm">{r.ai.output.summary}</p>
                  <p className="text-xs text-muted-foreground">{r.ai.provider} · {r.ai.model} · {t("aiAdvisory")}</p>
                </>
              ) : <p className="text-sm text-muted-foreground">{t("aiUnavailable")}</p>}
            </Section>

            <Section title={t("actions")} icon={<Lightbulb className="size-4 text-flag-yellow" aria-hidden="true" />}>
              <ul className="list-disc space-y-1 pl-5 text-sm">{r.recommendedActions.map((a) => <li key={a.en}>{a[lang]}</li>)}</ul>
              {r.limitations.length > 0 && (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer">{t("limitations")} ({r.limitations.length})</summary>
                  <ul className="list-disc space-y-0.5 pl-5 pt-1">{r.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
                </details>
              )}
            </Section>

            <Section title={t("timeline")}>
              <ol className="space-y-1.5 text-sm">
                {events.map((e) => (
                  <li key={e.id} className="flex justify-between gap-2">
                    <span>{tx(`stage.${e.stage}`, e.stage)}: {e.status}{e.message ? <span className="text-xs text-muted-foreground"> · {e.message}</span> : null}</span>
                    <time className="shrink-0 text-xs text-muted-foreground">{fmtAgo(e.created_at, locale)}</time>
                  </li>
                ))}
              </ol>
            </Section>
          </div>
        </div>
      )}
    </div>
  );
}

export default function IntelScanPage({ params }: { params: Params }) {
  return (
    <div className="space-y-4">
      <BackLink href="/soc/intel" namespace="soc.intel" label="back" />
      <Suspense fallback={<div className="space-y-3"><Skeleton className="h-16 w-80" /><Skeleton className="h-96 w-full" /></div>}>
        <Workspace params={params} />
      </Suspense>
    </div>
  );
}

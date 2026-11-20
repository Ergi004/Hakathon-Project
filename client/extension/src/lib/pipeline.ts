import { flagFor } from "./analyze-local";
import { defang, mask, maskKeepingUrls, stripQuery } from "./mask";
import type { ExtractedEmail, Flag, ScanView, ViewReason } from "./types";

/** Unique http(s) link targets, query and fragment removed. */
export function linkTargets(email: ExtractedEmail): string[] {
  const out = new Set<string>();
  for (const l of email.links) if (/^https?:\/\//i.test(l.href)) out.add(stripQuery(l.href).slice(0, 2048));
  return [...out].slice(0, 50);
}

/** AnalysisInput (SPEC 6.2) for POST /api/v1/scan. Personal data masked; URLs kept. */
export function toAnalysisInput(email: ExtractedEmail, locale: "sq" | "en") {
  const urls = linkTargets(email);
  if (email.client === "page") {
    return { kind: "url" as const, urls, text: email.text ? maskKeepingUrls(email.text).slice(0, 10_000) : undefined, channel: "web" as const, locale };
  }
  return {
    kind: "email_signals" as const,
    text: maskKeepingUrls(email.text).slice(0, 10_000) || undefined,
    urls,
    sender: email.sender?.slice(0, 320),
    subject: email.subject ? mask(email.subject).slice(0, 500) : undefined,
    attachments: email.attachments.slice(0, 20).map((a) => ({ name: a.name.slice(0, 255), mime: a.mime.slice(0, 255), size: 0 })),
    channel: "email" as const,
    locale,
  };
}

/** SPEC 12.2 signal report: masked subject, masked 600-char excerpt, defanged URLs, sender domain only. */
export function toSignals(email: ExtractedEmail, view: Pick<ScanView, "score" | "flag" | "reasons">, version: string) {
  return {
    subject: email.subject ? mask(email.subject).slice(0, 300) : undefined,
    bodyExcerpt: mask(email.text).replace(/\s+/g, " ").trim().slice(0, 600) || undefined,
    urls: linkTargets(email).map(defang),
    senderDomain: email.sender?.includes("@") ? email.sender.split("@").pop()!.toLowerCase().slice(0, 253) : undefined,
    attachments: email.attachments.slice(0, 20).map((a) => ({ name: mask(a.name).slice(0, 255), mime: a.mime.slice(0, 255) })),
    score: Math.round(view.score),
    flag: view.flag,
    reasonCodes: view.reasons.map((r) => r.code).slice(0, 20),
    version,
  };
}

/** Final score: the engine's score, raised (never lowered) by live threat intelligence. */
export function combineScore(base: { score: number; flag: Flag }, intelScore: number | null | undefined): { score: number; flag: Flag } {
  if (base.flag === "grey" || typeof intelScore !== "number" || intelScore <= base.score) return base;
  return { score: intelScore, flag: flagFor(intelScore) };
}

/** Decides what happens after the scan finished. */
export function decide(score: number, flag: Flag, threshold: number, autoSubmit: boolean): "submit" | "needs_consent" | "below" {
  if (flag === "grey" || score < threshold) return "below";
  return autoSubmit ? "submit" : "needs_consent";
}

export function topReasons(reasons: { code: string; weight: number; group?: string; evidence?: string; text_sq: string; text_en: string }[], locale: "sq" | "en", max = 6): ViewReason[] {
  return [...reasons].filter((r) => r.weight > 0).sort((a, b) => b.weight - a.weight).slice(0, max).map((r) => ({ code: r.code, weight: Math.round(r.weight), group: r.group, evidence: r.evidence, text: locale === "sq" ? r.text_sq : r.text_en }));
}

/** Provider summary → one short human line (normalised fields only). */
export function providerDetail(provider: string, status: string, summary: Record<string, unknown>, counts: { malicious: number | null; total: number | null }, t: (k: string, sub?: string[]) => string): string | undefined {
  if (status === "pending") return undefined;
  if (status !== "done") return undefined;
  switch (provider) {
    case "dns": return summary.resolves ? t("d_resolves") : t("d_notResolves");
    case "rdap": {
      const parts: string[] = [];
      if (typeof summary.registeredAt === "string") parts.push(t("d_registered", [summary.registeredAt]));
      if (typeof summary.registrar === "string") parts.push(summary.registrar);
      if (summary.privacy) parts.push(t("d_privacy"));
      return parts.join(" · ") || undefined;
    }
    case "urlhaus": return summary.listed ? t("d_listed", [String(summary.urlCount ?? 1)]) : t("d_notListed");
    case "crtsh": return typeof summary.count === "number" ? t("d_certs", [String(summary.count)]) : undefined;
    case "virustotal": return counts.total ? t("d_engines", [String(counts.malicious ?? 0), String(counts.total)]) : undefined;
    case "hybrid_analysis": return typeof summary.threatScore === "number" ? t("d_threat", [String(summary.threatScore)]) : typeof summary.verdict === "string" ? summary.verdict : undefined;
    case "internal": return typeof summary.imitates === "string" ? t("d_imitates", [summary.imitates]) : undefined;
    default: return undefined;
  }
}

/** Weighted progress: read 10, local 10, engine 30, intel 40 (by finished provider checks), report 10. */
export function progressOf(v: Pick<ScanView, "steps" | "intel">): number {
  const w: Record<string, number> = { read: 10, local: 10, engine: 30, intel: 40, report: 10 };
  let p = 0;
  for (const [k, state] of Object.entries(v.steps)) {
    if (state === "done" || state === "skipped" || state === "error") p += w[k];
    else if (state === "active" && k === "intel") {
      const rows = v.intel.domains.flatMap((d) => d.rows);
      const finished = rows.filter((r) => r.status !== "pending").length;
      p += rows.length ? (w.intel * finished) / rows.length : 4;
    } else if (state === "active") p += w[k] * 0.3;
  }
  return Math.round(Math.min(100, p));
}

export function emailFacts(email: ExtractedEmail): ScanView["found"] {
  const domains = [...new Set(linkTargets(email).map((u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } }).filter(Boolean))];
  return {
    links: email.links.length,
    domains: domains.slice(0, 10).map((d) => d.replace(/\./g, "[.]")),
    attachments: email.attachments.length,
    senderDomain: email.sender?.includes("@") ? email.sender.split("@").pop()!.toLowerCase().replace(/\./g, "[.]") : undefined,
  };
}

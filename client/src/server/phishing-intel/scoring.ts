import type { AnalysisResult } from "@/server/detection/types";
import { vtScore } from "./intelligence/virustotal/client";
import type { AuthResults, Finding, Reputation, RiskComponents, Severity, Verdict } from "./types";

/**
 * Risk scoring (PDF §7.6). Starting weights, to be calibrated on a labelled set.
 * Unavailable components are excluded and the rest re-normalised; the report
 * lists them under limitations so a missing provider never silently lowers risk.
 */
export const WEIGHTS: Record<keyof RiskComponents, number> = {
  virusTotal: 0.25,
  authentication: 0.15,
  urlDomain: 0.2,
  heuristics: 0.2,
  attachments: 0.1,
  campaign: 0.1,
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const sumWeights = (fs: Finding[], codes: RegExp) => fs.filter((f) => codes.test(f.code)).reduce((s, f) => s + f.weight, 0);

export function components(input: {
  channel: "email" | "sms" | "ott_message";
  engine: AnalysisResult;
  findings: Finding[];
  auth: AuthResults;
  reputations: Reputation[];
  vtAvailable: boolean;
  hasUrls: boolean;
  hasAttachments: boolean;
  smsSenderKnownOfficial?: boolean;
}): RiskComponents {
  const { engine, findings } = input;

  const vtScores = input.reputations.map(vtScore).filter((n): n is number => n !== null);
  const virusTotal = input.vtAvailable && vtScores.length ? Math.max(...vtScores) : null;

  let authentication: number | null = null;
  if (input.channel === "email") {
    if (input.auth.source === "absent" && !findings.some((f) => /mismatch|spoof/.test(f.code))) authentication = null;
    else {
      const fails = [input.auth.spf === "fail" || input.auth.spf === "softfail", input.auth.dkim === "fail", input.auth.dmarc === "fail"].filter(Boolean).length;
      authentication = clamp(fails * 30 + sumWeights(findings, /^(reply_to_mismatch|return_path_mismatch|display_name_spoof|message_id_mismatch)$/) * 3 + engine.groups.sender * 2);
    }
  } else {
    // SMS: sender identity stands in for email authentication.
    authentication = clamp(engine.groups.sender * 4 + sumWeights(findings, /^(malformed_sender|international_sender)$/) * 4);
  }

  const urlDomain = input.hasUrls ? clamp((engine.groups.links / 30) * 100 + sumWeights(findings, /^(link_text_mismatch|javascript_link|meta_refresh)$/) * 2) : null;

  const heuristics = clamp(
    (engine.groups.content / 25) * 70 +
      sumWeights(findings, /^(html_form|password_field|html_script|data_uri_html|html_obfuscation|hidden_content|rtl_override|mixed_script|app_install_lure|remote_access_lure|disable_protection|channel_switch|otp_request|payment_handle|callback_lure|exfil_telegram|exfil_webhook|exfil_google|exfil_form_service|exfil_php|exfil_endpoint|exfil_mailto|obfuscated_exfil|victim_ip_lookup)$/) * 2,
  );

  const attachments = input.hasAttachments
    ? clamp((engine.groups.attachments / 10) * 60 + sumWeights(findings, /^(disguised_executable|type_mismatch|html_attachment|svg_attachment|disk_image)$/) * 3)
    : null;

  // No campaign overlap is absence of evidence, not evidence of safety: leave it out (null) instead of scoring 0.
  const c = engine.campaign;
  const campaign = c ? (c.matchType === "known" ? clamp(60 + c.confidence * 40) : c.matchType === "similar" ? clamp(30 + c.confidence * 30) : 15) : engine.groups.reputation ? clamp(engine.groups.reputation * 10) : null;

  return { virusTotal, authentication, urlDomain, heuristics, attachments, campaign };
}

export function weightedRisk(c: RiskComponents): { score: number; unavailable: (keyof RiskComponents)[] } {
  let total = 0;
  let weight = 0;
  const unavailable: (keyof RiskComponents)[] = [];
  for (const key of Object.keys(WEIGHTS) as (keyof RiskComponents)[]) {
    const v = c[key];
    if (v === null) {
      unavailable.push(key);
      continue;
    }
    total += v * WEIGHTS[key];
    weight += WEIGHTS[key];
  }
  return { score: weight ? clamp(total / weight) : 0, unavailable };
}

/**
 * Hard signals are floors that nothing (including AI output) can lower:
 * many VirusTotal detections, or a red/dark-red verdict from the core engine.
 */
export function finalRisk(weighted: number, engine: AnalysisResult, reputations: Reputation[], findings: Finding[]): number {
  let score = Math.max(weighted, engine.score);
  const maxMal = Math.max(0, ...reputations.map((r) => r.malicious));
  if (maxMal >= 5) score = Math.max(score, 90);
  else if (maxMal >= 2) score = Math.max(score, 70);
  if (findings.some((f) => f.code === "disguised_executable")) score = Math.max(score, 85);
  // Credentials wired to a Telegram bot or chat webhook: no legitimate email does this.
  if (findings.some((f) => f.code === "exfil_telegram" || f.code === "exfil_webhook")) score = Math.max(score, 80);
  return clamp(score);
}

export function severityOf(score: number): Severity {
  if (score >= 90) return "critical";
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

/**
 * Verdict from the risk score, never weaker than the core Mburoja engine's flag:
 * red/dark red → malicious, orange → suspicious, yellow plus a classified
 * phishing technique → suspicious. Keeps the scanner consistent with /check.
 */
export function verdictOf(score: number, analysable: boolean, engine?: { flag: string; phishingTypes: number }): Verdict {
  if (!analysable) return "unknown";
  if (score >= 70 || engine?.flag === "red" || engine?.flag === "darkred") return "malicious";
  if (score >= 40 || engine?.flag === "orange" || (engine?.flag === "yellow" && engine.phishingTypes > 0)) return "suspicious";
  return "clean";
}

/**
 * Confidence in the verdict (kept separate from risk, PDF §7.6): grows with the
 * number of independent evidence sources and drops when components are missing.
 */
export function verdictConfidence(c: RiskComponents, evidenceCount: number): number {
  const available = Object.values(c).filter((v) => v !== null).length;
  const coverage = available / Object.keys(c).length;
  return Number(Math.min(0.95, 0.3 + coverage * 0.4 + Math.min(evidenceCount, 6) * 0.04).toFixed(2));
}

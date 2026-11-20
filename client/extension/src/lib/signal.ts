import { maskText } from "../../../src/server/detection/masks";
import type { Report } from "./api";
import type { Flag } from "./types";

/**
 * Signal reports (SPEC 12.2): what the extension may send to the SOC inbox.
 * Built only from the platform's already-masked scan report and masked again
 * here with the platform's own rules (src/server/detection/masks.ts), so the
 * extension and the server never disagree on what counts as personal data.
 * Never: the full email, recipients, or the user's identity.
 */

export type SubmitMode = "full" | "indicators" | "none";

/** Auto-submit policy after consent: orange/red/dark red → masked report, yellow → indicators only, green/grey → nothing. */
export function autoMode(flag: Flag): SubmitMode {
  if (flag === "orange" || flag === "red" || flag === "darkred") return "full";
  if (flag === "yellow") return "indicators";
  return "none";
}

export interface SignalReport {
  subject?: string;
  bodyExcerpt?: string;
  urls: string[];
  senderDomain?: string;
  auth?: { spf?: "pass" | "fail" | "none"; dkim?: "pass" | "fail" | "none"; dmarc?: "pass" | "fail" | "none" };
  attachments: { name: string; mime: string }[];
  score: number;
  flag: Exclude<Flag, "grey">;
  reasonCodes: string[];
  version: string;
  indicatorsOnly?: boolean;
  channel: "email" | "sms";
}

const toAuth = (v: string | undefined): "pass" | "fail" | "none" => (v === "pass" ? "pass" : v === "fail" || v === "softfail" ? "fail" : "none");

/** Yellow: indicators only (links, sender domain, auth, flag, reason codes). No subject, text or attachment names. */
export function indicatorsOnly(s: SignalReport): SignalReport {
  const { subject: _subject, bodyExcerpt: _body, ...rest } = s;
  void _subject;
  void _body;
  return { ...rest, attachments: [], indicatorsOnly: true };
}

export function buildSignal(report: Report, flag: Exclude<Flag, "grey">, version: string, mode: Exclude<SubmitMode, "none">): SignalReport {
  const email = report.evidence.email;
  const sms = report.evidence.sms;
  const indicatorsOnly = mode === "indicators";
  const senderDomain = email?.from?.match(/@([a-z0-9.-]+\.[a-z]{2,})/i)?.[1]?.toLowerCase();
  const reasonCodes = [
    ...report.evidence.engineReasons.filter((r) => r.weight > 0).map((r) => r.code),
    ...report.evidence.findings.map((f) => f.code),
  ];

  const signal: SignalReport = {
    urls: report.iocs.filter((i) => i.type === "url").map((i) => i.value).filter((u) => u.length <= 2048).slice(0, 50),
    ...(senderDomain && senderDomain.length <= 253 ? { senderDomain } : {}),
    ...(email && email.authentication.source !== "absent"
      ? { auth: { spf: toAuth(email.authentication.spf), dkim: toAuth(email.authentication.dkim), dmarc: toAuth(email.authentication.dmarc) } }
      : {}),
    attachments: [],
    score: Math.max(0, Math.min(100, Math.round(report.riskScore))),
    flag,
    reasonCodes: [...new Set(reasonCodes)].filter((c) => c.length <= 64).slice(0, 20),
    version,
    channel: sms ? "sms" : "email",
  };
  if (indicatorsOnly) return { ...signal, indicatorsOnly: true };

  const subject = email?.subject ? maskText(email.subject).slice(0, 300) : undefined;
  const excerpt = (email?.excerpt ?? sms?.excerpt ?? "").trim();
  return {
    ...signal,
    ...(subject ? { subject } : {}),
    ...(excerpt ? { bodyExcerpt: maskText(excerpt).slice(0, 600) } : {}),
    attachments: (email?.attachments ?? []).slice(0, 20).map((a) => ({ name: a.name.slice(0, 255), mime: a.mime.slice(0, 255) })),
  };
}

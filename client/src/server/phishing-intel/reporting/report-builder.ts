import { maskText } from "@/server/detection/masks";
import { defang } from "@/server/detection/normalize";
import type { AnalysisResult } from "@/server/detection/types";
import type { AiRun } from "../ai/orchestrator";
import type { ReputationOutcome } from "../intelligence/virustotal/reputation";
import type {
  AttributionResult,
  Classification,
  ExtractedIoc,
  Finding,
  ParsedMessage,
  RiskComponents,
  Severity,
  Stages,
  TechniqueHit,
  Verdict,
} from "../types";
import type { SmsSender } from "../channels/sms/sms-analyzer";

export const REPORT_VERSION = "pi-report-v1";

type Bilingual = { sq: string; en: string };

const REMEDIATION: Record<string, Bilingual[]> = {
  base_bad: [
    { sq: "Mos klikoni lidhjet dhe mos hapni bashkëngjitjet.", en: "Do not click the links or open the attachments." },
    { sq: "Mos jepni fjalëkalime, kode OTP ose të dhëna karte.", en: "Do not share passwords, OTP codes or card details." },
    { sq: "Raportojeni mesazhin te Mburoja dhe fshijeni.", en: "Report the message to Mburoja and delete it." },
  ],
  credential_phishing: [{ sq: "Nëse keni futur fjalëkalimin, ndryshojeni menjëherë dhe aktivizoni verifikimin me dy hapa.", en: "If you entered a password, change it now and turn on two-step verification." }],
  adversary_in_the_middle: [{ sq: "Dilni nga të gjitha sesionet aktive dhe rivendosni metodat MFA.", en: "Sign out of all active sessions and reset MFA methods." }],
  business_email_compromise: [{ sq: "Verifikoni çdo ndryshim pagese me telefon te një numër i njohur, jo nga emaili.", en: "Verify any payment change by phone using a known number, not the email." }],
  oauth_phishing: [{ sq: "Hiqni lejet e aplikacioneve të panjohura nga llogaria juaj.", en: "Revoke unknown app permissions from your account." }],
  malware_delivery: [{ sq: "Nëse e keni hapur skedarin, shkëputni pajisjen nga rrjeti dhe kontaktoni ekipin IT.", en: "If you opened the file, disconnect the device and contact IT support." }],
  payment_fraud: [{ sq: "Nëse keni paguar, kontaktoni bankën tuaj menjëherë për bllokim.", en: "If you paid, contact your bank immediately to block the payment." }],
  callback_scam: [{ sq: "Mos telefononi numrin në mesazh; përdorni numrin zyrtar të institucionit.", en: "Do not call the number in the message; use the institution's official number." }],
  qr_phishing: [{ sq: "Mos skanoni kodin QR; hyni në faqen zyrtare duke e shkruar vetë adresën.", en: "Do not scan the QR code; type the official address yourself." }],
  clean: [{ sq: "Nuk u gjetën shenja të qarta mashtrimi. Nëse keni dyshime, verifikoni me dërguesin nga një kanal zyrtar.", en: "No clear signs of fraud were found. If in doubt, verify with the sender through an official channel." }],
  unknown: [{ sq: "Nuk kishte mjaftueshëm përmbajtje për një vlerësim të besueshëm.", en: "There was not enough content for a reliable assessment." }],
};

export function remediation(verdict: Verdict, types: string[]): Bilingual[] {
  if (verdict === "clean") return REMEDIATION.clean;
  if (verdict === "unknown") return REMEDIATION.unknown;
  return [...REMEDIATION.base_bad, ...types.flatMap((t) => REMEDIATION[t] ?? [])];
}

export interface ReportInput {
  scanId: string;
  msg: ParsedMessage & { smsSender?: SmsSender };
  iocs: ExtractedIoc[];
  engine: AnalysisResult;
  findings: Finding[];
  rep: ReputationOutcome | null;
  classifications: Classification[];
  techniques: TechniqueHit[];
  attribution: AttributionResult;
  ai: AiRun | null;
  components: RiskComponents;
  unavailable: string[];
  risk: number;
  severity: Severity;
  verdict: Verdict;
  confidence: number;
  stages: Stages;
  generatedAt: string;
  /** Other scans sending data to the same endpoint, by endpoint key. */
  exfilRelated?: Record<string, { scans: number; latest: string[] }>;
}

/** Normalised investigation report (PDF §6.4, §20.1 channel-specific evidence). */
export function buildReport(r: ReportInput) {
  const types = r.classifications.filter((c) => c.dimension === "phishing_type").map((c) => c.value);
  const limitations: string[] = [];
  for (const u of r.unavailable) limitations.push(`Risk component unavailable: ${u}`);
  if (r.rep?.note) limitations.push(r.rep.note);
  const quota = r.rep?.skipped.filter((s) => s.reason === "quota").length ?? 0;
  if (quota) limitations.push(`${quota} indicator(s) not checked: VirusTotal quota reached`);
  const synthetic = r.rep?.skipped.filter((s) => s.reason === "synthetic").length ?? 0;
  if (synthetic) limitations.push(`${synthetic} indicator(s) use non-routable test domains and were not sent to VirusTotal`);
  if (r.msg.channel === "email" && r.msg.auth.source === "absent") limitations.push("No Authentication-Results header: SPF/DKIM/DMARC could not be verified");
  if (r.ai && r.ai.status !== "completed") limitations.push(r.ai.note ?? "AI analysis was not performed");
  limitations.push("Links were not opened: live page content was not analysed");
  if ((r.msg.exfil ?? []).length === 0 && r.msg.hrefs.length) limitations.push("Where a linked page sends data is only visible with a landing-page sandbox (not enabled)");

  const channelEvidence =
    r.msg.channel === "email"
      ? {
          email: {
            subject: r.msg.subject ? maskText(r.msg.subject) : null,
            from: r.msg.sender ?? null,
            replyTo: r.msg.replyTo ?? null,
            returnPath: r.msg.returnPath ?? null,
            authentication: r.msg.auth,
            attachments: r.msg.attachments.map((a) => ({ name: a.name, mime: a.mime, size: a.size, sha256: a.sha256 ?? null, detectedType: a.detectedType ?? null })),
            links: r.msg.hrefs.slice(0, 50).map((h) => ({ href: defang(h.href), text: h.display.slice(0, 120) })),
            // Masked, first 600 characters: what an extension signal report may carry (SPEC 12.2).
            excerpt: maskText(r.msg.text).slice(0, 600),
          },
        }
      : {
          sms: {
            sender: r.msg.sender ?? null,
            senderKind: r.msg.smsSender?.kind ?? "absent",
            internationalSender: r.msg.smsSender?.international ?? false,
            receivedAt: r.msg.receivedAt ?? null,
            excerpt: maskText(r.msg.text).slice(0, 600),
          },
        };

  return {
    version: REPORT_VERSION,
    scanId: r.scanId,
    channel: r.msg.channel.toUpperCase(),
    source: r.msg.source,
    generatedAt: r.generatedAt,
    verdict: r.verdict,
    riskScore: r.risk,
    severity: r.severity,
    confidence: r.confidence,
    riskComponents: r.components,
    stages: r.stages,
    evidence: {
      findings: r.findings.map((f) => ({ code: f.code, detail: f.detail, evidence: f.evidence ? defang(f.evidence) : null, weight: f.weight })),
      engineReasons: r.engine.reasons.map((x) => ({ code: x.code, group: x.group, weight: x.weight, text_sq: x.text_sq, text_en: x.text_en, evidence: x.evidence ?? null })),
      engineScore: r.engine.score,
      engineFlag: r.engine.flag,
      matchedInstitution: r.engine.matchedInstitution ?? null,
      ...channelEvidence,
    },
    iocs: r.iocs.map((i) => ({ type: i.type, value: i.display, locations: i.locations })),
    exfil: {
      endpoints: (r.msg.exfil ?? []).map((e) => {
        const host = e.host ? defang(e.host) : null;
        const vt = host ? r.rep?.reputations.find((x) => (x.type === "domain" || x.type === "ip") && x.value === host) : undefined;
        const related = r.exfilRelated?.[e.key];
        return {
          kind: e.kind,
          key: e.key,
          value: e.display,
          host,
          source: e.source,
          origin: e.origin ?? null,
          method: e.method ?? null,
          via: e.via,
          chatId: e.chatId ?? null,
          reputation: vt ? { found: vt.found, malicious: vt.malicious, suspicious: vt.suspicious, label: vt.threatLabel } : null,
          otherScans: related?.scans ?? 0,
          relatedScanIds: related?.latest ?? [],
        };
      }),
      note: "Static analysis of the email and its attachments; linked pages were not opened. Secrets (bot tokens, webhook keys) are redacted and never stored.",
    },
    reputation: {
      provider: "virustotal",
      status: r.rep?.status ?? "skipped",
      results: r.rep?.reputations ?? [],
      skipped: r.rep?.skipped ?? [],
    },
    classification: {
      phishingType: r.classifications.filter((c) => c.dimension === "phishing_type"),
      phishingFamily: r.classifications.filter((c) => c.dimension === "phishing_family"),
      malwareFamily: r.classifications.filter((c) => c.dimension === "malware_family"),
    },
    attribution: r.attribution,
    mitreAttack: r.techniques,
    ai: r.ai
      ? { status: r.ai.status, provider: r.ai.provider, model: r.ai.model, policy: r.ai.policy, advisory: true, output: r.ai.output }
      : null,
    limitations,
    recommendedActions: remediation(r.verdict, types),
    provenance: { engine: r.engine.modelVersion, report: REPORT_VERSION, aiProvider: r.ai?.provider ?? null, aiModel: r.ai?.model ?? null },
  };
}

export type ScanReport = ReturnType<typeof buildReport>;

import "server-only";

import type { Enums, Json } from "@/types/database";
import type { ReportInput } from "@/lib/schemas/analysis";
import { analyze } from "./detection";
import { loadContext } from "./detection/load-context";
import { maskText } from "./detection/masks";
import { defang, extractUrls, foldText, hostOf } from "./detection/normalize";
import { audit } from "./audit";
import { tryAdmin } from "./db";
import { randomToken, sha256 } from "./hash";
import { recomputeSafetyScore } from "./badges";
import { notifyWatchMatches } from "./watchlist";
import { startLiveScan } from "./intel/orchestrator";
import { municipalityId } from "./geo/regions";

export type CreateReportError = "unavailable" | "generic";

export interface CreatedReport {
  id: string;
  protocol: string;
  trackingToken: string;
  flag: Enums<"flag_level">;
  score: number;
  scan: { scanId: string; token: string } | null;
}

/**
 * Create a report from the public form, the check result page, a business
 * escalation or the extension (SPEC 7, 9, 12). Only masked text is stored.
 * The tracking token is returned once; only its hash is kept.
 */
export async function createReport(
  input: Omit<ReportInput, "website"> & { source?: Enums<"report_source">; reporterId?: string | null; reporterOrgId?: string | null; consentSignal?: boolean },
  meta: { ipHash?: string | null } = {},
): Promise<{ ok: true; data: CreatedReport } | { ok: false; error: CreateReportError }> {
  const db = tryAdmin();
  if (!db) return { ok: false, error: "unavailable" };
  const regionId = await municipalityId(db, input.regionCode);

  const masked = maskText(input.text ?? "");
  const sender = input.sender ? maskText(input.sender) : undefined;
  const urls = [...new Set([...(input.url ? [input.url] : []), ...extractUrls(input.text ?? "")])];
  const ctx = await loadContext();
  const result = await analyze(
    { kind: input.text ? "text" : "url", text: masked || undefined, urls, sender: input.sender, channel: input.channel, locale: input.locale },
    ctx,
  );

  try {
    const { data: message, error: msgError } = await db
      .from("messages")
      .insert({
        channel: input.channel,
        language: input.locale,
        sender_masked: sender ?? null,
        body_masked: masked || (input.url ? defang(input.url) : "-"),
        body_hash: sha256(foldText(masked || input.url || "")),
        urls: urls.map(defang),
        label: "unknown",
        score: result.score,
        flag: result.flag === "grey" ? null : result.flag,
        campaign_id: result.campaign?.id ?? null,
        institution_id: result.matchedInstitution?.id ?? null,
        tactic: input.category,
        received_at: new Date().toISOString(),
        source: input.source ?? "citizen_report",
      })
      .select("id")
      .single();
    if (msgError) throw msgError;

    const token = randomToken();
    const { data: report, error: repError } = await db
      .from("reports")
      .insert({
        source: input.source ?? "citizen_report",
        channel: input.channel,
        score: result.score,
        flag: result.flag,
        reasons: result.reasons as unknown as Json,
        message_id: message.id,
        campaign_id: result.campaign?.id ?? null,
        reporter_id: input.reporterId ?? null,
        reporter_org_id: input.reporterOrgId ?? null,
        reporter_contact: input.contact && input.contactConsent ? input.contact : null,
        tracking_token_hash: sha256(token),
        consent_signal_report: input.consentSignal ?? false,
        // Coarse, optional location chosen by the citizen; nothing is inferred from IP or text.
        region_id: regionId,
        region_source: regionId ? "user_selected" : null,
      })
      .select("id, protocol")
      .single();
    if (repError) throw repError;

    await db.from("report_events").insert({
      report_id: report.id,
      actor_id: input.reporterId ?? null,
      kind: "created",
      data: { source: input.source ?? "citizen_report", category: input.category, lost_money: input.lostMoney ?? false, check_id: input.checkId ?? null },
    });

    // IoCs from the report feed the triage view (defanged values).
    const iocRows = result.iocs
      .filter((i) => i.type === "domain" || i.type === "url")
      .map((i) => ({ type: i.type, value: i.value, campaign_id: result.campaign?.id ?? null, source: "report" }));
    if (iocRows.length) {
      await db.from("iocs").upsert(iocRows, { onConflict: "type,value", ignoreDuplicates: true });
    }

    await notifyWatchMatches(db, input.text ?? "", input.sender, report.protocol);
    if (input.reporterId) await recomputeSafetyScore(db, input.reporterId);

    await audit({
      actorId: input.reporterId ?? null,
      action: "report.create",
      entity: "report",
      entityId: report.id,
      data: { source: input.source ?? "citizen_report", flag: result.flag, hosts: urls.map((u) => hostOf(u)).filter(Boolean).length },
      ipHash: meta.ipHash ?? null,
    });

    let scan: CreatedReport["scan"] = null;
    if (urls[0]) {
      const started = await startLiveScan({ url: urls[0], reportId: report.id, deep: input.deepConsent === true || input.consentSignal === true, requestedBy: input.reporterId ?? null });
      if (started.ok) scan = { scanId: started.scanId, token: started.token };
    }

    return { ok: true, data: { id: report.id, protocol: report.protocol, trackingToken: token, flag: result.flag, score: result.score, scan } };
  } catch (error) {
    console.error("createReport failed", error instanceof Error ? error.message : error);
    return { ok: false, error: "generic" };
  }
}

export const PUBLIC_STATUS_ORDER: Enums<"report_status">[] = ["received", "under_review", "confirmed", "takedown_requested", "taken_down"];

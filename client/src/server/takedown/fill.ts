import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Enums } from "@/types/database";
import { defang } from "@/server/detection/normalize";
import { parseTemplateFile, render } from "./render";

type DB = SupabaseClient<Database>;
type Kind = Enums<"notice_type">;

export async function loadTemplate(db: DB, kind: Kind, locale: "sq" | "en") {
  const { data } = await db.from("templates").select("subject, body").eq("kind", kind).eq("locale", locale).eq("active", true).order("version", { ascending: false }).limit(1).maybeSingle();
  if (data) return data;
  const file = path.join(process.cwd(), "src", "server", "takedown", "templates", `${kind}.${locale}.md`);
  return parseTemplateFile(readFileSync(file, "utf8"));
}

/** Pick a recipient by matching registrar / hosting strings (SPEC 11.1 step 1). */
export async function pickRecipient(db: DB, kind: Kind, domain: { registrar: string | null; hosting_country: string | null } | null) {
  const { data } = await db.from("recipients").select("id, name, match_pattern, sla_hours, abuse_email").eq("kind", kind);
  const list = data ?? [];
  const hay = `${domain?.registrar ?? ""} ${domain?.hosting_country ?? ""}`.toLowerCase();
  return list.find((r) => r.match_pattern && hay.includes(r.match_pattern.toLowerCase())) ?? list[0] ?? null;
}

export interface NoticeContext {
  protocol: string;
  campaign: { id: string; code: string; imitated_name: string | null; first_seen: string | null };
  domain: { domain: string; registrar: string | null; hosting_country: string | null } | null;
  analystName: string;
}

/** Fill the template for one notice (SPEC 11.1 step 2). Throws on any missing placeholder. */
export async function buildNotice(db: DB, kind: Kind, locale: "sq" | "en", c: NoticeContext) {
  const [tpl, iocs, reports, domains] = await Promise.all([
    loadTemplate(db, kind, locale),
    db.from("iocs").select("type, value").eq("campaign_id", c.campaign.id).limit(50),
    db.from("reports").select("id", { count: "exact", head: true }).eq("campaign_id", c.campaign.id),
    db.from("campaign_domains").select("domains(domain)").eq("campaign_id", c.campaign.id),
  ]);
  const mainDomain = c.domain?.domain ?? (domains.data?.[0]?.domains as { domain: string } | null)?.domain ?? "—";
  const iocLines = (iocs.data ?? []).map((i) => `- ${i.type}: ${defang(i.value.replace(/\[\.\]/g, "."))}`);
  const evidence =
    locale === "sq"
      ? `Mesazhe të maskuara, të dhëna whois dhe certifikata për ${defang(mainDomain)}, kronologjia e fushatës ${c.campaign.code}. Paketa PDF bashkëngjitet pas miratimit.`
      : `Masked messages, whois and certificate facts for ${defang(mainDomain)}, timeline of campaign ${c.campaign.code}. The PDF pack is attached after approval.`;
  const vars = {
    protocol: c.protocol,
    campaign_code: c.campaign.code,
    domain: defang(mainDomain),
    imitated_institution: c.campaign.imitated_name ?? (locale === "sq" ? "një institucion" : "an institution"),
    first_seen: c.campaign.first_seen ?? "—",
    report_count: String(reports.count ?? 0),
    iocs: iocLines.length ? iocLines.join("\n") : "-",
    evidence_summary: evidence,
    analyst_name: c.analystName,
    org_name: "Mburoja SOC",
  };
  return { subject: render(tpl.subject, vars), body: render(tpl.body, vars) };
}

export function noticeLocale(kind: Kind, domain: string | null): "sq" | "en" {
  // AKCESK and Albanian (.al) infrastructure get Albanian; others English.
  if (kind === "akcesk") return "sq";
  return domain && /\.al(\.|$)/.test(domain) ? "sq" : "en";
}

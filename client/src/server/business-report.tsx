import "server-only";

import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toCsv } from "@/lib/csv";
import type { Database } from "@/types/database";

const s = StyleSheet.create({ page: { padding: 40, fontSize: 10, fontFamily: "Helvetica" }, h1: { fontSize: 18, marginBottom: 8 }, h2: { fontSize: 12, marginTop: 14, marginBottom: 4 }, row: { flexDirection: "row", borderBottom: "1 solid #ddd", paddingVertical: 2 }, c: { width: "25%" } });

/** SPEC 9 B11: monthly incidents, takedown times and trend for one organization. */
export async function buildComplianceReport(db: SupabaseClient<Database>, org: { id: string; name: string }, month: string, format: "csv" | "pdf") {
  const start = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const end = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const { data: insts } = await db.from("institutions").select("id").eq("organization_id", org.id);
  const instIds = (insts ?? []).map((i) => i.id);
  const [alerts, campaigns, notices, reports] = await Promise.all([
    db.from("brand_alerts").select("title, severity, status, created_at").eq("org_id", org.id).gte("created_at", start).lt("created_at", end),
    instIds.length ? db.from("campaigns").select("id, code, tactic, status, message_count, first_seen, last_seen").in("institution_id", instIds) : Promise.resolve({ data: [] as { id: string; code: string; tactic: string; status: string; message_count: number; first_seen: string | null; last_seen: string | null }[] }),
    instIds.length ? db.from("takedown_notices").select("protocol, kind, status, sent_at, resolved_at, campaigns!inner(institution_id)").in("campaigns.institution_id", instIds).gte("created_at", start).lt("created_at", end) : Promise.resolve({ data: [] as { protocol: string; kind: string; status: string; sent_at: string | null; resolved_at: string | null }[] }),
    instIds.length ? db.from("reports").select("created_at, campaigns!inner(institution_id)").in("campaigns.institution_id", instIds).gte("created_at", start).lt("created_at", end) : Promise.resolve({ data: [] as { created_at: string }[] }),
  ]);
  const hours = (notices.data ?? []).filter((n) => n.sent_at && n.resolved_at).map((n) => (Date.parse(n.resolved_at!) - Date.parse(n.sent_at!)) / 3_600_000);
  const median = hours.length ? hours.sort((a, b) => a - b)[Math.floor(hours.length / 2)].toFixed(1) : "-";
  const byDay = new Map<string, number>();
  for (const r of reports.data ?? []) byDay.set(r.created_at.slice(0, 10), (byDay.get(r.created_at.slice(0, 10)) ?? 0) + 1);

  if (format === "csv") {
    const rows = [
      ...(alerts.data ?? []).map((a) => ({ section: "alert", ref: a.title, status: a.status, severity: a.severity, date: a.created_at })),
      ...(campaigns.data ?? []).map((c) => ({ section: "campaign", ref: c.code, status: c.status, severity: c.tactic, date: c.last_seen })),
      ...(notices.data ?? []).map((n) => ({ section: "takedown", ref: n.protocol, status: n.status, severity: n.kind, date: n.sent_at })),
      ...[...byDay.entries()].map(([d, n]) => ({ section: "reports_per_day", ref: String(n), status: "", severity: "", date: d })),
      { section: "summary", ref: `median_takedown_hours=${median}`, status: "", severity: "", date: month },
    ];
    return Buffer.from(toCsv(rows, ["section", "ref", "status", "severity", "date"]), "utf8");
  }
  const doc = (
    <Document title={`Mburoja ${org.name} ${month}`}>
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>{org.name} · {month}</Text>
        <Text>Brand alerts: {alerts.data?.length ?? 0} · Campaigns: {campaigns.data?.length ?? 0} · Takedowns: {notices.data?.length ?? 0} · Reports: {reports.data?.length ?? 0}</Text>
        <Text>Median time to takedown: {median} h</Text>
        <Text style={s.h2}>Campaigns</Text>
        {(campaigns.data ?? []).map((c) => <View key={c.id} style={s.row}><Text style={s.c}>{c.code}</Text><Text style={s.c}>{c.tactic}</Text><Text style={s.c}>{c.status}</Text><Text style={s.c}>{c.message_count}</Text></View>)}
        <Text style={s.h2}>Takedowns</Text>
        {(notices.data ?? []).map((n) => <View key={n.protocol} style={s.row}><Text style={s.c}>{n.protocol}</Text><Text style={s.c}>{n.kind}</Text><Text style={s.c}>{n.status}</Text><Text style={s.c}>{n.sent_at?.slice(0, 10) ?? "-"}</Text></View>)}
        <Text style={s.h2}>Reports per day</Text>
        {[...byDay.entries()].sort().map(([d, n]) => <Text key={d}>{d}: {n}</Text>)}
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}

import "server-only";

import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { defang } from "@/server/detection/normalize";

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", lineHeight: 1.4 },
  h1: { fontSize: 20, marginBottom: 6 },
  h2: { fontSize: 13, marginTop: 16, marginBottom: 6 },
  muted: { color: "#555" },
  row: { flexDirection: "row", borderBottom: "1 solid #ddd", paddingVertical: 3 },
  c1: { width: "22%" },
  c2: { width: "78%", fontFamily: "Courier" },
  box: { border: "1 solid #ccc", padding: 8, marginBottom: 6 },
});

/**
 * Evidence pack (SPEC 11.4): cover, campaign summary, ≤3 masked messages,
 * defanged IoCs, whois and certificate facts, timeline, analyst and approver.
 * No citizen contact data.
 */
export async function buildEvidencePdf(db: SupabaseClient<Database>, noticeId: string, approverName: string): Promise<Buffer> {
  const { data: n } = await db
    .from("takedown_notices")
    .select("protocol, kind, created_at, campaigns(id, code, tactic, imitated_name, first_seen, last_seen, message_count, summary), domains(domain, registrar, registered_at, age_days, nameserver, hosting_country, privacy, certificates(cert_id, issuer, not_before, not_after, san)), creator:profiles!takedown_notices_created_by_fkey(full_name)")
    .eq("id", noticeId)
    .single();
  const c = n?.campaigns as { id: string; code: string; tactic: string; imitated_name: string | null; first_seen: string | null; last_seen: string | null; message_count: number; summary: string | null } | null;
  const d = n?.domains as { domain: string; registrar: string | null; registered_at: string | null; age_days: number | null; nameserver: string | null; hosting_country: string | null; privacy: boolean | null; certificates: { cert_id: string; issuer: string | null; not_before: string | null; not_after: string | null; san: string[] }[] } | null;
  const [msgs, iocs, events] = await Promise.all([
    c ? db.from("messages").select("body_masked, channel, received_at").eq("campaign_id", c.id).eq("label", "phishing").limit(3) : Promise.resolve({ data: [] }),
    c ? db.from("iocs").select("type, value, first_seen").eq("campaign_id", c.id).limit(60) : Promise.resolve({ data: [] }),
    db.from("notice_events").select("kind, created_at").eq("notice_id", noticeId).order("created_at"),
  ]);

  const doc = (
    <Document title={`Evidence ${n?.protocol}`} author="Mburoja SOC">
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>Evidence pack / Paketa e provave</Text>
        <Text>Protocol: {n?.protocol}</Text>
        <Text>Campaign: {c?.code} ({c?.tactic})</Text>
        <Text>Imitated: {c?.imitated_name ?? "-"}</Text>
        <Text style={s.muted}>Generated {new Date().toISOString()} · Synthetic demo data</Text>

        <Text style={s.h2}>Campaign summary</Text>
        <Text>First seen {c?.first_seen ?? "-"}, last seen {c?.last_seen ?? "-"}, {c?.message_count ?? 0} messages.</Text>
        {c?.summary ? <Text>{c.summary}</Text> : null}

        <Text style={s.h2}>Masked sample messages</Text>
        {(msgs.data ?? []).map((m, i) => (
          <View key={i} style={s.box}>
            <Text style={s.muted}>{m.channel} · {m.received_at ?? ""}</Text>
            <Text>{m.body_masked}</Text>
          </View>
        ))}

        <Text style={s.h2}>Indicators (defanged)</Text>
        {(iocs.data ?? []).map((i, k) => (
          <View key={k} style={s.row}>
            <Text style={s.c1}>{i.type}</Text>
            <Text style={s.c2}>{defang(i.value.replace(/\[\.\]/g, "."))}</Text>
          </View>
        ))}

        {d && (
          <>
            <Text style={s.h2}>Whois and certificate facts</Text>
            <Text>Domain: {defang(d.domain)}</Text>
            <Text>Registrar: {d.registrar ?? "-"} · Registered: {d.registered_at ?? "-"} ({d.age_days ?? "?"} days)</Text>
            <Text>Nameserver: {d.nameserver ?? "-"} · Hosting: {d.hosting_country ?? "-"} · Privacy: {d.privacy ? "yes" : "no"}</Text>
            {d.certificates.map((ct) => (
              <Text key={ct.cert_id}>Cert {ct.cert_id}: {ct.issuer ?? "-"}, {ct.not_before ?? "?"} → {ct.not_after ?? "?"}, SAN {ct.san.map((x) => defang(x)).join(", ")}</Text>
            ))}
          </>
        )}

        <Text style={s.h2}>Timeline</Text>
        {(events.data ?? []).map((e, k) => (
          <Text key={k}>{e.created_at} · {e.kind}</Text>
        ))}

        <Text style={s.h2}>Sign-off</Text>
        <Text>Analyst: {(n?.creator as { full_name: string | null } | null)?.full_name ?? "-"}</Text>
        <Text>Approver: {approverName}</Text>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}

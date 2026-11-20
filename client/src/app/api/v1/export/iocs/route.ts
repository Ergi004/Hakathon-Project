import { NextResponse, type NextRequest } from "next/server";
import { toCsv } from "@/lib/csv";
import { apiError, authenticate } from "@/server/api";
import { audit } from "@/server/audit";
import { getSessionUser, hasMinRole } from "@/server/auth";
import { tryAdmin } from "@/server/db";
import { defang } from "@/server/detection/normalize";

/** GET /api/v1/export/iocs?format=csv|json&campaign=CODE: staff session or API key with scope iocs. */
export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  const staff = session && hasMinRole(session.profile.platform_role, "soc_analyst");
  const key = staff ? null : await authenticate(req);
  if (!staff && !(key?.kind === "key" && key.scopes.includes("iocs"))) return apiError(401, "unauthorized", "Staff session or API key with scope iocs required");
  const db = tryAdmin();
  if (!db) return apiError(503, "unavailable", "Service unavailable");

  const code = req.nextUrl.searchParams.get("campaign");
  let q = db.from("iocs").select("type, value, first_seen, last_seen, campaigns(code, status)").order("last_seen", { ascending: false }).limit(10_000);
  if (code) {
    const { data: c } = await db.from("campaigns").select("id").eq("code", code).maybeSingle();
    if (!c) return apiError(404, "not_found", "Unknown campaign");
    q = q.eq("campaign_id", c.id);
  } else if (!staff) {
    q = q.not("campaign_id", "is", null);
  }
  const { data } = await q;
  const rows = (data ?? []).map((i) => ({
    type: i.type,
    value: defang(i.value.replace(/\[\.\]/g, ".")),
    campaign: (i.campaigns as { code: string } | null)?.code ?? null,
    first_seen: i.first_seen,
    last_seen: i.last_seen,
  }));
  await audit({ actorId: session?.user.id ?? null, action: "iocs.export", entity: "iocs", data: { count: rows.length, campaign: code, via: staff ? "session" : "api_key" } });

  if (req.nextUrl.searchParams.get("format") === "csv") {
    return new NextResponse(toCsv(rows, ["type", "value", "campaign", "first_seen", "last_seen"]), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="iocs${code ? `-${code}` : ""}.csv"` },
    });
  }
  // STIX-lite JSON (SPEC 10 A5): flat indicators with pattern strings.
  return NextResponse.json({
    type: "bundle",
    spec: "stix-lite",
    generated: new Date().toISOString(),
    objects: rows.map((r) => ({ type: "indicator", ioc_type: r.type, pattern: `[${r.type === "url" ? "url" : r.type === "domain" ? "domain-name" : r.type}:value = '${r.value}']`, campaign: r.campaign, valid_from: r.first_seen })),
  });
}

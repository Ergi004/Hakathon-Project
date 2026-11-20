import { NextResponse } from "next/server";
import { tryAdmin } from "@/server/db";
import { aiPolicy } from "@/server/phishing-intel/ai/orchestrator";
import { enabled } from "@/server/phishing-intel/http";
import { vtConfig } from "@/server/phishing-intel/intelligence/virustotal/reputation";

/** GET /api/phishing-intelligence/health — configuration and queue health. Never returns secrets. */
export async function GET() {
  const db = tryAdmin();
  let queue: { queued: number; processing: number } | null = null;
  if (db) {
    const [q, p] = await Promise.all([
      db.from("phishing_scans").select("id", { count: "exact", head: true }).eq("status", "queued"),
      db.from("phishing_scans").select("id", { count: "exact", head: true }).eq("status", "processing"),
    ]);
    queue = q.error ? null : { queued: q.count ?? 0, processing: p.count ?? 0 };
  }
  const vt = vtConfig();
  const ai = aiPolicy();
  const ok = enabled() && queue !== null;
  return NextResponse.json(
    {
      status: ok ? "ok" : "degraded",
      enabled: enabled(),
      database: queue !== null,
      queue,
      virusTotal: { configured: Boolean(vt.apiKey), mode: "lookup_only", perMinute: vt.perMinute, perDay: vt.perDay },
      ai: { ollama: ai.ollamaConfigured, gemini: ai.geminiConfigured, defaultProvider: ai.defaultProvider, cloudEscalation: ai.cloudEscalation, localOnly: ai.localOnly },
    },
    { status: ok ? 200 : 503 },
  );
}

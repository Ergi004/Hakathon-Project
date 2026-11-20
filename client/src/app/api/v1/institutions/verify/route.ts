import { NextResponse, type NextRequest } from "next/server";
import { channelKey } from "@/server/detection/context";
import { scoreDomain } from "@/server/detection/domain-score";
import { loadContext } from "@/server/detection/load-context";
import { hostOf } from "@/server/detection/normalize";
import { apiError } from "@/server/api";
import { ipHash } from "@/server/hash";
import { limit } from "@/server/rate-limit";

/** GET /api/v1/institutions/verify?domain= or ?sender= → { official, institution? } */
export async function GET(req: NextRequest) {
  if (!(await limit(`verify:${ipHash(req.headers)}`, 120, 3600)).allowed) return apiError(429, "rate_limited", "Too many requests");
  const domain = req.nextUrl.searchParams.get("domain");
  const sender = req.nextUrl.searchParams.get("sender");
  if (!domain && !sender) return apiError(400, "missing_param", "Pass ?domain= or ?sender=");
  const ctx = await loadContext();
  let institutionId: string | undefined;
  if (domain) {
    const host = hostOf(domain.slice(0, 2048));
    if (!host) return apiError(422, "invalid_domain", "Not a domain");
    institutionId = scoreDomain(host, ctx).official?.institutionId;
  } else if (sender) {
    const s = sender.slice(0, 320);
    const isPhone = /^[+\d][\d\s.-]{5,}$/.test(s);
    institutionId = ctx.officialChannels.get(channelKey(isPhone ? "phone" : s.includes("@") ? "email" : "sms_sender", s));
  }
  const inst = institutionId ? ctx.institutions.get(institutionId) : undefined;
  return NextResponse.json(
    { official: !!inst, ...(inst ? { institution: { id: inst.id, name: inst.name } } : {}) },
    { headers: { "Cache-Control": "public, s-maxage=300" } },
  );
}

import { NextResponse, type NextRequest } from "next/server";
import { preflight } from "@/server/api";
import { PHISHING_FAMILIES, PHISHING_TYPES } from "@/server/phishing-intel/detection/classifier";
import { guard } from "@/server/phishing-intel/http";

export const OPTIONS = preflight;

/** GET /api/phishing-intelligence/intelligence/families — the taxonomy, with the three dimensions kept separate. */
export async function GET(req: NextRequest) {
  const g = await guard(req);
  if (!g.ok) return g.res;
  const { data } = await g.db.from("phishing_classifications").select("value").eq("dimension", "malware_family").limit(1000);
  return NextResponse.json(
    {
      phishingTypes: PHISHING_TYPES,
      phishingFamilies: Object.keys(PHISHING_FAMILIES),
      malwareFamiliesObserved: [...new Set((data ?? []).map((d) => d.value))].sort(),
      note: "phishing_type, phishing_family and malware_family are independent dimensions; malware families come only from file reputation.",
    },
    { headers: g.cors },
  );
}

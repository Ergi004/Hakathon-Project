import type { DetectionContext } from "./context";
import { officialCores, parseHost } from "./domain-score";

export interface WhoisFinding {
  young: boolean;
  privacy: boolean;
  certFast: boolean;
  certBrand: boolean;
  riskyInfra: boolean;
}

const DAY = 86_400_000;

/** Signals from stored whois / CT rows only. Never fetches anything (SPEC rule 6). */
export function scoreWhois(host: string, ctx: DetectionContext, now = new Date()): WhoisFinding | null {
  const intel = ctx.domainIntel.get(host) ?? ctx.domainIntel.get(parseHost(host).registrable);
  if (!intel) return null;

  let age = intel.ageDays ?? null;
  if (age === null && intel.registeredAt) age = Math.floor((now.getTime() - Date.parse(intel.registeredAt)) / DAY);

  const certFast =
    !!intel.certNotBefore &&
    !!intel.registeredAt &&
    Date.parse(intel.certNotBefore) - Date.parse(intel.registeredAt) <= 2 * DAY &&
    Date.parse(intel.certNotBefore) >= Date.parse(intel.registeredAt);

  const cores = officialCores(ctx);
  const certBrand = (intel.certSan ?? []).some((san) => {
    const s = san.toLowerCase();
    return cores.some((c) => s.includes(c)) && !ctx.officialDomains.has(s);
  });

  const pair = `${(intel.registrar ?? "").toLowerCase()}|${(intel.hostingCountry ?? "").toLowerCase()}`;

  return {
    young: age !== null && age >= 0 && age < 30,
    privacy: intel.privacy === true,
    certFast,
    certBrand,
    riskyInfra: ctx.riskyInfra.has(pair),
  };
}

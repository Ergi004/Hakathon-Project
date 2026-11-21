import "server-only";

import { createCrtsh } from "./crtsh";
import { createDns } from "./dns";
import { createHybridAnalysis } from "./hybrid-analysis";
import { createRdap } from "./rdap";
import { createUrlhaus } from "./urlhaus";
import { createVirusTotal } from "./virustotal";

/**
 * The only place provider keys are read. Keys stay on the server: never
 * NEXT_PUBLIC_, never logged, never returned to the browser.
 */
export function intelMode(): "mock" | "live" {
  return process.env.INTEL_MODE === "live" ? "live" : "mock";
}

export function liveProviders() {
  const vt = process.env.VIRUS_TOTAL_API_KEY;
  const uh = process.env.AUTH_ABUSE_API_KEY;
  const ha = process.env.HYBRID_ANALYSIS_API_KEY;
  return {
    virustotal: vt ? createVirusTotal(vt) : null,
    urlhaus: uh ? createUrlhaus(uh) : null,
    hybridAnalysis: ha ? createHybridAnalysis(ha) : null,
    rdap: createRdap(),
    crtsh: createCrtsh(),
    dns: createDns(),
  };
}

import { defang } from "@/server/detection/normalize";
import { extractExfil, redactSecrets, type ExfilEndpoint } from "../intelligence/exfil-extractor";
import type { UrlscanResult } from "./urlscan";

/**
 * Turns a urlscan.io result (rendered DOM, recorded requests, script bodies)
 * into what the SOC needs: the forms on the landing page and where they, or
 * the page's scripts, send data. Static analysis of text urlscan already
 * captured: nothing here opens the page or runs its code. Pure.
 */

export interface LandingForm {
  action: string;
  method: "GET" | "POST";
  password: boolean;
  inputs: string[];
}

export interface LandingFindings {
  finalUrl: string | null;
  finalDomain: string | null;
  page: Record<string, string | number | null>;
  verdict: { score: number | null; malicious: boolean; categories: string[]; brands: string[]; tags: string[] };
  forms: LandingForm[];
  exfil: ExfilEndpoint[];
  requests: { total: number; domains: string[]; posts: { method: string; url: string }[]; redirects: string[] };
  ipLookup: boolean;
}

const CDN = /(^|\.)(googleapis\.com|gstatic\.com|cdnjs\.cloudflare\.com|code\.jquery\.com|cdn\.jsdelivr\.net|unpkg\.com|bootstrapcdn\.com|fontawesome\.com|googletagmanager\.com|google-analytics\.com|cloudflareinsights\.com|hcaptcha\.com|recaptcha\.net)$/i;

/** Inputs that collect credentials, payment or identity data. */
const CRED_INPUT = /pass|pwd|passwd|login|user|email|e-mail|card|cvv|cvc|expir|otp|pin\b|token|iban|ssn|nid|personal|kod/i;
const SERVICE_KINDS = new Set(["telegram_bot", "discord_webhook", "webhook", "google_apps_script", "google_form", "form_service", "mailto"]);

export function isCredentialForm(f: LandingForm): boolean {
  if (f.password) return true;
  const hits = f.inputs.filter((n) => CRED_INPUT.test(n)).length;
  return f.method === "POST" && hits >= 2;
}

function sameSite(host: string, pageHost: string | null): boolean {
  if (!pageHost) return false;
  const base = (h: string) => h.toLowerCase().split(".").slice(-2).join(".");
  return host === pageHost || base(host) === base(pageHost);
}

const hostOfUrl = (u: string) => {
  try {
    return new URL(u).hostname.toLowerCase();
  } catch {
    return null;
  }
};

function resolve(action: string, base: string | null): string | null {
  try {
    return new URL(action, base ?? undefined).toString();
  } catch {
    return null;
  }
}

/** Forms in the rendered DOM: where they submit, whether they ask for a password, and input names only (no values). */
export function parseForms(dom: string, base: string | null): LandingForm[] {
  const out: LandingForm[] = [];
  for (const m of dom.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)) {
    const attrs = m[1];
    const raw = attrs.match(/\baction\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const action = (raw?.[1] ?? raw?.[2] ?? raw?.[3] ?? "").trim();
    const abs = action && !/^(#|javascript:)/i.test(action) ? (action.toLowerCase().startsWith("mailto:") ? action : resolve(action, base)) : base;
    const inputs = [...m[2].matchAll(/<input\b[^>]*\bname\s*=\s*["']?([\w.[\]-]{1,40})/gi)].map((x) => x[1]).slice(0, 10);
    out.push({
      action: abs ? defang(abs) : "",
      method: /\bmethod\s*=\s*["']?get/i.test(attrs) ? "GET" : "POST",
      password: /type\s*=\s*["']?password/i.test(m[2]),
      inputs,
    });
    if (out.length >= 20) break;
  }
  return out;
}

/** Scripts worth reading: the site's own code first, CDN libraries skipped, bounded. */
export function pickScripts(result: UrlscanResult, max = 8): { url: string; hash: string }[] {
  const apex = result.page.apexDomain?.toLowerCase();
  const scripts = result.data.requests
    .filter((r) => r.request.type === "Script" && r.response?.hash && (r.response.dataLength ?? 0) <= 600_000)
    .map((r) => ({ url: r.request.request.url, hash: r.response!.hash! }))
    .filter((s) => !CDN.test(hostOfUrl(s.url) ?? ""));
  const own = scripts.filter((s) => apex && (hostOfUrl(s.url) ?? "").endsWith(apex));
  const other = scripts.filter((s) => !own.includes(s));
  return [...own, ...other].slice(0, max);
}

export function processLanding(result: UrlscanResult, dom: string | null, scripts: { url: string; body: string }[]): LandingFindings {
  const finalUrl = result.page.url ?? result.task.url ?? null;
  const finalDomain = result.page.domain ?? (finalUrl ? hostOfUrl(finalUrl) : null);
  const exfil = new Map<string, ExfilEndpoint>();
  let ipLookup = false;
  const take = (r: ReturnType<typeof extractExfil>) => {
    ipLookup ||= r.ipLookup;
    for (const e of r.endpoints) if (!exfil.has(e.key)) exfil.set(e.key, e);
  };
  const origin = finalDomain ?? undefined;

  const forms = dom ? parseForms(dom, finalUrl) : [];
  const credForms = forms.filter(isCredentialForm);
  // Form targets come only from credential forms (below); search/newsletter forms are not exfiltration.
  if (dom) take(extractExfil(dom.replace(/<form\b[^>]*>/gi, "<form>"), { source: "landing_page", origin, mode: "full" }));
  // Relative form actions resolved against the page: the page's own server is a destination too.
  const synthetic = credForms
    .filter((f) => f.action)
    .map((f) => `<form action="${f.action.replace(/\[\.\]/g, ".").replace(/^hxxp/i, "http")}" method="${f.method}"></form>`)
    .join("\n");
  if (synthetic) take(extractExfil(synthetic, { source: "landing_page", origin, mode: "full" }));
  for (const s of scripts) {
    const u = hostOfUrl(s.url);
    take(extractExfil(s.body, { source: "landing_page", origin: u ? `${u}${new URL(s.url).pathname}`.slice(0, 200) : origin, mode: "full" }));
  }

  // Requests the page made while loading (visit beacons often go straight to a bot).
  const posts: { method: string; url: string }[] = [];
  const redirects: string[] = [];
  for (const r of result.data.requests) {
    const url = r.request.request.url;
    const method = (r.request.request.method ?? "GET").toUpperCase();
    take(extractExfil(url, { source: "landing_page", origin, mode: "tokens" }));
    if (method !== "GET" && method !== "OPTIONS") {
      posts.push({ method, url: defang(redactSecrets(url.split("?")[0])).slice(0, 300) });
      // A beacon to another site while loading; the page's own server is covered by its forms.
      const host = hostOfUrl(url);
      if (host && !sameSite(host, finalDomain)) take(extractExfil(`fetch("${url.split("?")[0]}")`, { source: "landing_page", origin, mode: "full" }));
    }
    if (r.request.redirectResponse) redirects.push(defang(redactSecrets(url)).slice(0, 300));
  }

  const p = result.page;
  const o = result.verdicts.overall;
  return {
    finalUrl: finalUrl ? defang(redactSecrets(finalUrl)) : null,
    finalDomain,
    page: {
      title: p.title?.slice(0, 200) ?? null,
      ip: p.ip ?? null,
      asn: p.asn ?? null,
      asnname: p.asnname ?? null,
      country: p.country ?? null,
      server: p.server ?? null,
      status: p.status !== undefined ? String(p.status) : null,
      tlsIssuer: p.tlsIssuer ?? null,
      domainAgeDays: p.domainAgeDays ?? null,
    },
    verdict: { score: o?.score ?? null, malicious: o?.malicious ?? false, categories: o?.categories ?? [], brands: o?.brands ?? [], tags: o?.tags ?? [] },
    forms,
    // Without a credential form, generic endpoints (analytics, site APIs) are noise; bots, webhooks
    // and form-collection services are reported regardless.
    exfil: [...exfil.values()].filter((e) => credForms.length > 0 || SERVICE_KINDS.has(e.kind)).slice(0, 50),
    requests: {
      total: result.data.requests.length,
      domains: [...new Set(result.lists.domains)].slice(0, 30),
      posts: posts.slice(0, 20),
      redirects: [...new Set(redirects)].slice(0, 10),
    },
    ipLookup,
  };
}

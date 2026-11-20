import type { DetectionContext, DomainIntel } from "./context";
import { parseHost } from "./domain-score";
import { extractUrls, hostOf, parseSender, stripSynthetic } from "./normalize";

const DAY_MS = 86_400_000;
const LOOKUP_MS = 5_000;
const SERVICES_MS = 60 * 60 * 1000;
const RDAP_FALLBACK = "https://rdap.org/";

/** Registries used when the IANA directory is slow or missing. */
const KNOWN_REGISTRIES: ReadonlyMap<string, string> = new Map([
  ["com", "https://rdap.verisign.com/com/v1/"],
  ["net", "https://rdap.verisign.com/net/v1/"],
  ["org", "https://rdap.publicinterestregistry.org/rdap/"],
]);

function withDeadline<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  return Promise.race([work, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/** Days since an RDAP registration date. Null when the date is missing or in the future. */
export function ageFromRegistration(registeredAt: string, now = new Date()): number | null {
  const at = Date.parse(registeredAt);
  if (Number.isNaN(at)) return null;
  const days = Math.floor((now.getTime() - at) / DAY_MS);
  return days >= 0 ? days : null;
}

/** Registration event date from an RDAP domain object. */
export function registrationDate(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const events = (body as { events?: unknown }).events;
  if (!Array.isArray(events)) return null;
  for (const event of events) {
    if (!event || typeof event !== "object") continue;
    const row = event as { eventAction?: unknown; eventDate?: unknown };
    if (row.eventAction !== "registration" || typeof row.eventDate !== "string") continue;
    if (!Number.isNaN(Date.parse(row.eventDate))) return row.eventDate;
  }
  return null;
}

/** Hosts a person submitted: every link, plus the domain of an email sender. */
export function submittedHosts(input: {
  kind?: string;
  urls?: string[];
  subject?: string;
  text?: string;
  sender?: string;
}): string[] {
  const hrefs = (input.urls ?? []).map((url) => url.trim()).filter(Boolean);
  const prose = input.kind === "phone" ? "" : [input.subject, input.text].filter(Boolean).join("\n");
  const fromText = prose ? extractUrls(prose) : [];
  const hosts = [...hrefs, ...fromText].map((url) => hostOf(url)).filter((host): host is string => !!host);
  const senderDomain = input.sender ? parseSender(input.sender).domain : null;
  if (senderDomain) hosts.push(senderDomain);
  return [...new Set(hosts)];
}

/** RDAP query URL. Uses the registry from the IANA map when that TLD is listed. */
export function rdapUrl(domain: string, services?: ReadonlyMap<string, string>): string {
  const labels = domain.toLowerCase().split(".");
  let base = RDAP_FALLBACK;
  if (services) {
    for (let i = 1; i < labels.length; i++) {
      const match = services.get(labels.slice(i).join("."));
      if (match) {
        base = match;
        break;
      }
    }
  }
  const root = base.endsWith("/") ? base : `${base}/`;
  return `${root}domain/${encodeURIComponent(domain.toLowerCase())}`;
}

let servicesCache: { at: number; map: Map<string, string> } | null = null;

/** IANA RDAP bootstrap. Empty when the directory cannot be loaded. */
export async function loadRdapServices(fetcher: typeof fetch = fetch): Promise<Map<string, string>> {
  if (servicesCache && Date.now() - servicesCache.at < SERVICES_MS) return servicesCache.map;
  const map = new Map(KNOWN_REGISTRIES);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), LOOKUP_MS);
  try {
    const res = await withDeadline(
      fetcher("https://data.iana.org/rdap/dns.json", {
        signal: ctrl.signal,
        headers: { accept: "application/json" },
      }),
      LOOKUP_MS,
    );
    if (res.ok) {
      const body = (await res.json()) as { services?: unknown };
      if (Array.isArray(body.services)) {
        for (const row of body.services) {
          if (!Array.isArray(row) || row.length < 2) continue;
          const tlds = row[0];
          const urls = row[1];
          if (!Array.isArray(tlds) || !Array.isArray(urls) || typeof urls[0] !== "string") continue;
          const base = urls[0].endsWith("/") ? urls[0] : `${urls[0]}/`;
          for (const tld of tlds) if (typeof tld === "string") map.set(tld.toLowerCase(), base);
        }
      }
    }
  } catch {
    // The known registries above still cover .com, .net and .org.
  } finally {
    clearTimeout(timer);
    servicesCache = { at: Date.now(), map };
  }
  return map;
}

/**
 * Registration date from the domain's RDAP server. Does not request the
 * domain's own website. Synthetic fixture hosts are skipped.
 */
export async function lookupRegistration(
  domain: string,
  fetcher: typeof fetch = fetch,
  services?: ReadonlyMap<string, string>,
): Promise<string | null> {
  const host = domain.trim().toLowerCase();
  const { suffix } = stripSynthetic(host);
  if (!host.includes(".") || suffix) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), LOOKUP_MS);
  try {
    const res = await withDeadline(
      fetcher(rdapUrl(host, services), {
        signal: ctrl.signal,
        headers: { accept: "application/rdap+json, application/json" },
        redirect: "follow",
      }),
      LOOKUP_MS,
    );
    if (!res.ok) return null;
    return registrationDate(await res.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function remember(ctx: DetectionContext, intel: DomainIntel) {
  const key = intel.domain.toLowerCase();
  const prev = ctx.domainIntel.get(key);
  ctx.domainIntel.set(key, { ...prev, ...intel, domain: key });
}

/**
 * Look up the registration age of every submitted domain that we do not
 * already know, and attach it before scoring. A failed lookup leaves that
 * host unchanged.
 */
export async function fillMissingDomainAges(
  ctx: DetectionContext,
  hosts: string[],
  now = new Date(),
  fetcher: typeof fetch = fetch,
  services?: ReadonlyMap<string, string>,
): Promise<void> {
  const pending = [
    ...new Set(hosts.map((host) => parseHost(host).registrable.toLowerCase()).filter((domain) => domain.includes("."))),
  ];
  if (!pending.length) return;
  const directory = services ?? (await loadRdapServices(fetcher));
  await Promise.all(
    pending.map(async (domain) => {
      const existing = ctx.domainIntel.get(domain);
      if (existing && (existing.ageDays != null || existing.registeredAt)) return;
      const registeredAt = await lookupRegistration(domain, fetcher, directory);
      if (!registeredAt) return;
      remember(ctx, { domain, registeredAt, ageDays: ageFromRegistration(registeredAt, now) });
    }),
  );
}

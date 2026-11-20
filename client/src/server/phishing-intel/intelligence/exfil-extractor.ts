import { createHash } from "node:crypto";
import { defang, refang } from "@/server/detection/normalize";
import type { Finding } from "../types";

/**
 * Where does a phishing page send what the victim types? (docs/PHISHING-INTEL.md §Exfiltration)
 *
 * Static analysis only: HTML/JS from the email body and from HTML/SVG/JS
 * attachments is read as text, never rendered or executed, and nothing is
 * fetched. Common obfuscation layers (base64 / atob, data: URIs, unescape,
 * String.fromCharCode, \x escapes, HTML entities) are decoded up to two levels.
 *
 * Secrets stay out of storage: Telegram bot tokens and webhook secrets are kept
 * only as an ID, a redacted display form and a SHA-256 for exact matching.
 * They are never used to contact the attacker's infrastructure.
 */

export type ExfilKind =
  | "telegram_bot"
  | "discord_webhook"
  | "webhook"
  | "google_apps_script"
  | "google_form"
  | "form_service"
  | "php_handler"
  | "form_action"
  | "js_endpoint"
  | "mailto";

export type ExfilSource = "email_html" | "attachment" | "text" | "landing_page";
type Via = "plain" | "base64" | "percent" | "charcode" | "escape" | "entities";

export interface ExfilEndpoint {
  kind: ExfilKind;
  /** Correlation key without secrets, e.g. "telegram:bot:7712345678" or "url:collect.example/next.php". */
  key: string;
  /** Redacted and defanged, safe to show. */
  display: string;
  /** Host to check for reputation, null for shared services (Telegram, Discord, Google…). */
  host: string | null;
  source: ExfilSource;
  /** Attachment file name when source = attachment. */
  origin?: string;
  method?: "POST" | "GET";
  via: Via;
  /** Telegram chat that receives the data (the attacker's chat), when present in the code. */
  chatId?: string;
  /** SHA-256 of the full secret (token / webhook secret), for exact matching only. */
  secretHash?: string;
}

const MAX_LAYER = 1_000_000;
const MAX_LAYERS = 30;

const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const redact = (secret: string) => (secret.length > 8 ? `${secret.slice(0, 4)}…${secret.slice(-3)}` : "…");

/** Mostly readable text (rejects random binary that happens to be valid base64). */
function printable(s: string): boolean {
  if (!s) return false;
  const bad = (s.match(/[^\t\n\r\x20-\x7e -￿]|�/g) ?? []).length;
  return bad / s.length < 0.05;
}

function b64(s: string): string | null {
  const clean = s.replace(/\s+/g, "");
  if (clean.length < 16 || clean.length % 4 === 1) return null;
  const out = Buffer.from(clean, "base64").toString("utf8");
  return printable(out) ? out : null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n) % 0x110000))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16) % 0x110000))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

/** The text itself plus every decodable hidden layer (depth ≤ 2). */
export function decodeLayers(content: string): { text: string; via: Via }[] {
  const layers: { text: string; via: Via }[] = [{ text: content.slice(0, MAX_LAYER), via: "plain" }];
  const seen = new Set<string>([layers[0].text]);
  const push = (text: string | null, via: Via) => {
    if (!text || text.length < 8 || layers.length >= MAX_LAYERS) return;
    const t = text.slice(0, MAX_LAYER);
    if (seen.has(t)) return;
    seen.add(t);
    layers.push({ text: t, via });
  };
  let frontier = [...layers];
  for (let depth = 0; depth < 2 && frontier.length; depth++) {
    const start = layers.length;
    for (const { text } of frontier) {
      for (const m of text.matchAll(/atob\(\s*["'`]([A-Za-z0-9+/=\s]{16,})["'`]\s*\)/g)) push(b64(m[1]), "base64");
      for (const m of text.matchAll(/data:[a-z/+.-]+;base64,([A-Za-z0-9+/=]{24,})/gi)) push(b64(m[1]), "base64");
      for (const m of text.matchAll(/["'`]([A-Za-z0-9+/]{80,}={0,2})["'`]/g)) push(b64(m[1]), "base64");
      for (const m of text.matchAll(/(?:unescape|decodeURIComponent|decodeURI)\(\s*["'`]([^"'`]{10,})["'`]\s*\)/gi)) {
        try {
          push(decodeURIComponent(m[1]), "percent");
        } catch {
          // malformed escape sequence: not a hidden layer
        }
      }
      for (const m of text.matchAll(/String\.fromCharCode\(\s*([\d\s,]{10,})\)/g)) {
        const codes = m[1].split(",").map((n) => Number(n.trim())).filter((n) => Number.isInteger(n) && n > 0 && n < 0x110000);
        if (codes.length >= 4) push(String.fromCodePoint(...codes.slice(0, 20_000)), "charcode");
      }
      for (const m of text.matchAll(/((?:\\x[0-9a-f]{2}|\\u[0-9a-f]{4}){8,})/gi)) {
        push(m[1].replace(/\\x([0-9a-f]{2})|\\u([0-9a-f]{4})/gi, (_, x, u) => String.fromCharCode(parseInt(x ?? u, 16))), "escape");
      }
      if ((text.match(/&#x?[0-9a-f]+;/gi) ?? []).length > 20) push(decodeEntities(text), "entities");
    }
    frontier = layers.slice(start);
  }
  return layers;
}

/** Shared services: the host itself is legitimate, the account/ID inside the URL is the indicator. */
const SERVICE_PATTERNS: { kind: ExfilKind; re: RegExp; build: (m: RegExpMatchArray) => Omit<ExfilEndpoint, "source" | "via" | "origin" | "kind"> }[] = [
  {
    kind: "telegram_bot",
    re: /api\.telegram\.org\/bot(\d{6,12}):([A-Za-z0-9_-]{30,50})/g,
    build: (m) => ({ key: `telegram:bot:${m[1]}`, display: `api[.]telegram[.]org/bot${m[1]}:${redact(m[2])}`, host: null, secretHash: sha(`${m[1]}:${m[2]}`) }),
  },
  {
    kind: "telegram_bot",
    re: /["'`](\d{8,10}):(AA[A-Za-z0-9_-]{30,40})["'`]/g,
    build: (m) => ({ key: `telegram:bot:${m[1]}`, display: `bot${m[1]}:${redact(m[2])}`, host: null, secretHash: sha(`${m[1]}:${m[2]}`) }),
  },
  {
    kind: "discord_webhook",
    re: /https?:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/api\/webhooks\/(\d{15,22})\/([A-Za-z0-9_-]{40,100})/g,
    build: (m) => ({ key: `discord:webhook:${m[1]}`, display: `discord[.]com/api/webhooks/${m[1]}/${redact(m[2])}`, host: null, secretHash: sha(m[2]) }),
  },
  {
    kind: "webhook",
    re: /https:\/\/hooks\.slack\.com\/services\/(T[A-Z0-9]+)\/(B[A-Z0-9]+)\/([A-Za-z0-9]{20,})/g,
    build: (m) => ({ key: `slack:${m[1]}/${m[2]}`, display: `hooks[.]slack[.]com/services/${m[1]}/${m[2]}/${redact(m[3])}`, host: null, secretHash: sha(m[3]) }),
  },
  {
    kind: "webhook",
    re: /https?:\/\/webhook\.site\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi,
    build: (m) => ({ key: `webhook.site:${m[1].toLowerCase()}`, display: `webhook[.]site/${m[1].toLowerCase()}`, host: null }),
  },
  {
    kind: "webhook",
    re: /https?:\/\/(e[on][a-z0-9]{10,})\.m\.pipedream\.net/gi,
    build: (m) => ({ key: `pipedream:${m[1].toLowerCase()}`, display: `${m[1].toLowerCase()}[.]m[.]pipedream[.]net`, host: null }),
  },
  {
    kind: "google_apps_script",
    re: /https?:\/\/script\.google\.com\/macros\/s\/([A-Za-z0-9_-]{20,})\/exec/g,
    build: (m) => ({ key: `gas:${m[1]}`, display: `script[.]google[.]com/macros/s/${m[1]}/exec`, host: null }),
  },
  {
    kind: "google_form",
    re: /https?:\/\/docs\.google\.com\/forms\/(?:u\/\d+\/)?d\/(?:e\/)?([A-Za-z0-9_-]{20,})\/formResponse/g,
    build: (m) => ({ key: `gform:${m[1]}`, display: `docs[.]google[.]com/forms/d/e/${m[1]}/formResponse`, host: null }),
  },
  {
    kind: "form_service",
    re: /https?:\/\/(?:www\.)?((?:formspree\.io\/f|getform\.io\/f|usebasin\.com\/f|submit-form\.com)\/[A-Za-z0-9_-]+|formsubmit\.co\/(?:ajax\/)?(?:[^\s"'`<>)/]+@[a-z0-9.-]+\.[a-z]{2,}|[a-f0-9]{20,})|api\.emailjs\.com\/api\/v1\.0\/email\/send(?:-form)?)/gi,
    build: (m) => ({ key: `svc:${m[1].toLowerCase()}`, display: defang(m[1]), host: null }),
  },
];

/**
 * Redact service secrets anywhere in a URL or text before it is stored or shown
 * (bot tokens and webhook keys in request lists, redirects, final URLs).
 */
export function redactSecrets(s: string): string {
  return s
    .replace(/(bot\d{6,12}):[A-Za-z0-9_-]{30,50}/g, (_, id) => `${id}:[REDACTED]`)
    .replace(/(\/api\/webhooks\/\d{15,22}\/)[A-Za-z0-9_-]{40,100}/g, "$1[REDACTED]")
    .replace(/(hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/)[A-Za-z0-9]{20,}/g, "$1[REDACTED]")
    .replace(/(["'`])(\d{8,10}):AA[A-Za-z0-9_-]{30,40}(["'`])/g, "$1$2:[REDACTED]$3");
}

/** Libraries, fonts and CDNs pages load: not exfiltration. */
const BENIGN_HOSTS = /(^|\.)(googleapis\.com|gstatic\.com|cdnjs\.cloudflare\.com|code\.jquery\.com|cdn\.jsdelivr\.net|unpkg\.com|bootstrapcdn\.com|fontawesome\.com|cloudflare\.com|w3\.org|schema\.org)$/i;
/** Analytics, ads and error telemetry: they receive page events, not what the victim types. */
const TELEMETRY_HOSTS =
  /(^|\.)(google-analytics\.com|analytics\.google\.com|googletagmanager\.com|googlesyndication\.com|googleadservices\.com|doubleclick\.net|withgoogle\.com|facebook\.net|clarity\.ms|hotjar\.(com|io)|sentry\.io|nr-data\.net|newrelic\.com|segment\.(io|com)|mixpanel\.com|amplitude\.com|cloudflareinsights\.com|reddit\.com|tiktok\.com|linkedin\.com|bing\.com|yandex\.(ru|com)|plausible\.io|intercom\.io|hubspot\.com|hs-analytics\.net)$/i;
/** Kits often look up the victim's IP before sending; a strong tell, not an endpoint. */
const IP_LOOKUP = /https?:\/\/(?:api\.ipify\.org|ipinfo\.io|ipapi\.co|ip-api\.com|api\.db-ip\.com|geolocation-db\.com|freegeoip\.app|extreme-ip-lookup\.com|ipwho\.is)/i;
const SHARED_SERVICE_HOST = /(^|\.)(telegram\.org|discord(app)?\.com|slack\.com|google\.com|formspree\.io|getform\.io|formsubmit\.co|usebasin\.com|submit-form\.com|emailjs\.com|webhook\.site|pipedream\.net)$/i;

function normalizeEndpoint(raw: string): { url: URL; key: string } | null {
  const v = refang(raw.trim()).replace(/^\/\//, "https://");
  try {
    const url = new URL(v);
    if (!/^https?:$/.test(url.protocol)) return null;
    return { url, key: `url:${url.hostname.toLowerCase()}${url.pathname.replace(/\/+$/, "") || "/"}` };
  } catch {
    return null;
  }
}

const URL_IN_JS = String.raw`((?:https?:)?\/\/[^"'\x60\s<>]+)`;
const JS_PATTERNS: { re: RegExp; method?: "POST" | "GET" }[] = [
  { re: new RegExp(String.raw`\b(?:fetch|navigator\.sendBeacon)\s*\(\s*["'\x60]` + URL_IN_JS + "[\"'\\x60]", "gi") },
  { re: new RegExp(String.raw`\$\.(?:post|ajax)\s*\(\s*["'\x60]` + URL_IN_JS + "[\"'\\x60]", "gi"), method: "POST" },
  { re: new RegExp(String.raw`\baxios\.post\s*\(\s*["'\x60]` + URL_IN_JS + "[\"'\\x60]", "gi"), method: "POST" },
  { re: new RegExp(String.raw`\.open\s*\(\s*["']POST["']\s*,\s*["'\x60]` + URL_IN_JS + "[\"'\\x60]", "gi"), method: "POST" },
  { re: new RegExp(String.raw`\burl\s*:\s*["'\x60]` + URL_IN_JS + "[\"'\\x60]", "gi") },
  { re: new RegExp(String.raw`\.action\s*=\s*["'\x60]` + URL_IN_JS + "[\"'\\x60]", "gi"), method: "POST" },
];

/**
 * mode "full": HTML/JS (email HTML, attachments). mode "tokens": plain text
 * (only service tokens/webhooks, never generic URLs, which are just links).
 */
export function extractExfil(
  content: string,
  opts: { source: ExfilSource; origin?: string; mode: "full" | "tokens" },
): { endpoints: ExfilEndpoint[]; ipLookup: boolean } {
  const found = new Map<string, ExfilEndpoint>();
  let ipLookup = false;
  const add = (e: Omit<ExfilEndpoint, "source" | "origin">) => {
    const prev = found.get(e.key);
    if (prev) {
      if (!prev.chatId && e.chatId) prev.chatId = e.chatId;
      if (prev.via !== "plain" && e.via === "plain") prev.via = "plain";
      return;
    }
    if (found.size >= 50) return;
    found.set(e.key, { ...e, source: opts.source, ...(opts.origin ? { origin: opts.origin } : {}) });
  };

  const layers = opts.mode === "full" ? decodeLayers(content) : [{ text: content.slice(0, MAX_LAYER), via: "plain" as const }];
  // Kits often keep the chat id in plain code and hide only the token (or the reverse): search every layer.
  const CHAT = /chat_?id["'`]?\s*[:=]\s*["'`]?(-?\d{5,16})/i;
  // Also one level of indirection: `var cid = "-100…"; … chat_id: cid`.
  const viaVariable = () => {
    for (const l of layers) {
      const name = l.text.match(/chat_?id["'`]?\s*[:=]\s*([A-Za-z_$][\w$]{0,40})\b/i)?.[1];
      if (!name || /^(true|false|null|undefined)$/.test(name)) continue;
      const assign = new RegExp(`\\b${name.replace(/\$/g, "\\$")}\\s*=\\s*["'\`]?(-?\\d{5,16})`);
      for (const l2 of layers) {
        const v = l2.text.match(assign)?.[1];
        if (v) return v;
      }
    }
    return undefined;
  };
  const anyChatId = layers.map((l) => l.text.match(CHAT)?.[1]).find(Boolean) ?? viaVariable();
  for (const { text, via } of layers) {
    const chatId = text.match(CHAT)?.[1] ?? anyChatId;
    for (const p of SERVICE_PATTERNS) {
      for (const m of text.matchAll(p.re)) add({ kind: p.kind, via, method: "POST", ...p.build(m), ...(p.kind === "telegram_bot" && chatId ? { chatId } : {}) });
    }
    if (opts.mode !== "full") continue;
    if (IP_LOOKUP.test(text)) ipLookup = true;

    const classify = (raw: string, kind: "form_action" | "js_endpoint", method?: "POST" | "GET") => {
      // URLs assembled at runtime (`${host}/x`) cannot be resolved statically.
      if (/\$\{|%7B/i.test(raw)) return;
      const mail = raw.match(/^mailto:([^?\s"'<>]+)/i);
      if (mail) return add({ kind: "mailto", key: `mailto:${mail[1].toLowerCase()}`, display: defang(mail[1].toLowerCase()), host: null, via, method: "POST" });
      const n = normalizeEndpoint(raw);
      if (!n) return;
      const host = n.url.hostname.toLowerCase();
      if (BENIGN_HOSTS.test(host) || TELEMETRY_HOSTS.test(host) || IP_LOOKUP.test(n.url.href) || SHARED_SERVICE_HOST.test(host)) return; // services are caught above
      const php = /\.php\d?$/i.test(n.url.pathname);
      add({ kind: php ? "php_handler" : kind, key: n.key, display: defang(`${n.url.protocol}//${host}${n.url.pathname}`), host, via, ...(method ? { method } : {}) });
    };

    for (const m of text.matchAll(/<form\b([^>]*)>/gi)) {
      const action = m[1].match(/\baction\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const value = (action?.[1] ?? action?.[2] ?? action?.[3] ?? "").trim();
      if (!value || value.startsWith("#") || /^javascript:/i.test(value)) continue;
      const method = /\bmethod\s*=\s*["']?get/i.test(m[1]) ? "GET" : "POST";
      classify(decodeEntities(value), "form_action", method);
    }
    for (const { re, method } of JS_PATTERNS) for (const m of text.matchAll(re)) classify(m[1], "js_endpoint", method);
  }
  return { endpoints: [...found.values()], ipLookup };
}

const FINDING: Record<ExfilKind, { code: string; weight: number; detail: string }> = {
  telegram_bot: { code: "exfil_telegram", weight: 25, detail: "Captured data is sent to a Telegram bot" },
  discord_webhook: { code: "exfil_webhook", weight: 20, detail: "Captured data is sent to a chat webhook" },
  webhook: { code: "exfil_webhook", weight: 20, detail: "Captured data is sent to a chat webhook" },
  google_apps_script: { code: "exfil_google", weight: 15, detail: "Captured data is sent to a Google Apps Script or Form" },
  google_form: { code: "exfil_google", weight: 15, detail: "Captured data is sent to a Google Apps Script or Form" },
  form_service: { code: "exfil_form_service", weight: 15, detail: "Captured data is sent to a form-collection service" },
  php_handler: { code: "exfil_php", weight: 12, detail: "Captured data is sent to a PHP script on another server" },
  form_action: { code: "exfil_endpoint", weight: 10, detail: "A form sends captured data to another server" },
  js_endpoint: { code: "exfil_endpoint", weight: 10, detail: "Script code sends captured data to another server" },
  mailto: { code: "exfil_mailto", weight: 10, detail: "A form emails the captured data to an address" },
};

/** One finding per code. Email-body forms already score as html_form, so only their PHP/service targets add weight. */
export function exfilFindings(endpoints: ExfilEndpoint[], ipLookup: boolean): Finding[] {
  const out = new Map<string, Finding>();
  for (const e of endpoints) {
    if (e.source === "email_html" && (e.kind === "form_action" || e.kind === "js_endpoint")) continue;
    const f = FINDING[e.kind];
    if (!out.has(f.code)) out.set(f.code, { code: f.code, detail: f.detail, evidence: e.display, weight: f.weight });
  }
  if (endpoints.some((e) => e.via !== "plain")) {
    out.set("obfuscated_exfil", { code: "obfuscated_exfil", detail: "The data destination is hidden with encoding (base64, escapes)", weight: 8 });
  }
  if (ipLookup) out.set("victim_ip_lookup", { code: "victim_ip_lookup", detail: "The page looks up the victim's IP address and location", weight: 6 });
  return [...out.values()];
}

/** Attachments worth reading as text: HTML, SVG, scripts and HTA files, by name, MIME or content. */
export function isScriptableAttachment(name: string, mime: string, head: string): boolean {
  if (/\.(s?html?|xhtml|svg|js|hta|mht|mhtml)$/i.test(name)) return true;
  if (/text\/html|image\/svg|javascript|application\/hta/i.test(mime)) return true;
  return /^\s*(<!doctype html|<html|<svg|<script)/i.test(head);
}

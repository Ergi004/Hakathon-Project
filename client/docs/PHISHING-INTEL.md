# Phishing Intelligence Scanner

Additive module that implements the MVP of *Phishing Detection Platform – Technical Architecture* (rev. 1.1, Gemini + smishing).
It extends Mburoja without changing existing pages, auth or the detection engine.

## Compatibility map (PDF §18)

| PDF asks for | Mburoja has | Decision |
|---|---|---|
| Next.js API Routes | Next 16 Route Handlers | New routes under `src/app/api/phishing-intelligence/` |
| Existing auth | Supabase session, `mbi_` install tokens, `mbk_` org API keys (`src/server/api.ts`) | Reused via `src/server/phishing-intel/principal.ts`. API keys need the `scan` scope |
| Existing DB / ORM | Supabase Postgres, SQL migrations, RLS, no ORM | Migration `20261120000017_phishing_intel.sql` |
| Redis + BullMQ | None. Cron route + `scripts/cron-run.ts` | No second queue: Postgres row state + `after()` + cron job `process-scans` |
| Heuristics | `src/server/detection` | Reused as-is. The scanner adds email/SMS channel findings on top |
| Gemini | `src/server/llm.ts` (free-text explanations) | New JSON-schema calls in `ai/providers.ts`. `llm.ts` is unchanged |
| Ollama | None | Optional, enabled only when `OLLAMA_URL` is set |
| Extension (Chrome + Firefox) | SPEC §12 asks for Vite + @crxjs (Chrome only) | `extension/`: TypeScript + esbuild (`npm run ext:build`), one source tree with separate MV3 manifests for Chrome and Firefox. See `extension/README.md` |

## Layout

```
src/server/phishing-intel/
  types.ts                     shared contracts
  principal.ts                 who is calling + ownership checks
  http.ts                      route guard, submit + after() processing
  scan-service.ts              pipeline P1–P6, retry, cron sweeper
  scoring.ts                   PDF §7.6 weights, severity, verdict, confidence
  channels/email/              EML (postal-mime), headers, HTML, attachments
  channels/sms/                sender parsing, smishing lures
  intelligence/ioc-extractor   URL, domain, IP, email, phone, short code, hash
  intelligence/virustotal/     v3 client (GET only) + cache/quota
  intelligence/mitre-mapper    evidence-backed ATT&CK techniques
  detection/classifier         phishing_type / phishing_family / malware_family
  attribution/                 campaign correlation + evidence-based actor confidence
  ai/                          prompt v1, schema validation, Ollama/Gemini, routing
  reporting/report-builder     normalised report (PDF §6.4)
src/lib/schemas/phishing-intel.ts   zod request contracts
```

## API (`/api/phishing-intelligence`)

Each route needs a session cookie, or `Authorization: Bearer mbi_…|mbk_…`.

| Method | Path | Notes |
|---|---|---|
| POST | `/scan` | `channel: "EMAIL" \| "SMS"`. Returns 202 with `scanId`. Idempotent per owner (send an `Idempotency-Key` header, or the content hash is used). Body limit 2.5 MB. 30 scans/hour by default |
| POST | `/smishing/scan` | Same as `/scan` with `channel=SMS` |
| GET | `/scans?channel=SMS&status=&limit=&before=` | Scans the caller may see |
| GET | `/scans/:id` | Status, progress, stages, events |
| POST | `/scans/:id/retry` | Only for `failed` or `partial` scans, at most 3 attempts |
| GET | `/reports/:id` | Normalised report. Returns 409 until the report is ready |
| GET | `/iocs?type=PHONE&q=` | Also available at `/intelligence/iocs`. Limited to the caller's own scans |
| GET | `/intelligence/actors`, `/intelligence/actors/:id` | Evidence rows are visible to SOC staff only |
| GET | `/intelligence/families` | Taxonomy |
| GET | `/intelligence/campaigns` | Non-staff callers see only public campaigns |
| GET | `/health` | Configuration and queue counts. Never returns secrets |

Email request: `{ "channel": "EMAIL", "source": "gmail", "email": { "raw": "<EML>" } }`, or structured fields (`subject`, `sender`, `headers`, `body`, `html`, `urls`, `attachments[{name,mime,size,sha256}]`).
SMS request: `{ "channel": "SMS", "message": { "text": "...", "sender": "+355..." } }`.
Options for both: `useVirusTotal`, `aiMode` (`off|local|hybrid`), `allowCloudAnalysis`, `threatAttribution`, `locale`.

## Rules this module keeps

- **VirusTotal is lookup only.** It uses `GET /urls/{id}`, `/domains`, `/ip_addresses` and `/files/{hash}`. Nothing is submitted, so VirusTotal never fetches a user URL (hard rule 6).
- **Indicators that are not sent to VirusTotal:** `.example`, `.test` and `.invalid` domains, official domains, and private IPs.
- **Quotas and cache.** The default quota is 4 lookups/minute and 500/day, shared across instances through `rate_limit_hit`. Results are cached in `ioc_reputation` for 24 hours (6 hours when VirusTotal has no record).
- **What is stored.** Only masked text, links, sender, auth results and attachment metadata/hashes. Raw bodies, raw headers and file bytes are never stored. Retries re-run on this minimised input.
- **AI is advisory only.** It never changes the risk score or verdict. Its quotes must appear verbatim in the message, it may not introduce new indicators, and its confidence is capped at 0.6. Its type suggestion is used only when the rules found nothing.
- **Cloud AI escalation.** Gemini is called only when policy allows it (`AI_LOCAL_ONLY`, `AI_CLOUD_ESCALATION_ENABLED`, data classification, the request option) and when the case justifies it: Ollama was missing or invalid, or the risk falls in the grey zone.
- **Attribution needs explicit `actor_evidence` rows.** A campaign overlap alone names no actor, and a single source or a single evidence kind gives at most `possible`.
- **Hard floors on risk.** Five or more VirusTotal detections → at least 90. A disguised executable → at least 85. The core engine's score is also a floor.

## Configuration (server env)

```
VT_API_KEY=            # or the existing VIRUS_TOTAL_API_KEY
VT_BASE_URL=https://www.virustotal.com/api/v3
VT_RATE_PER_MIN=4  VT_RATE_PER_DAY=500  VT_MAX_LOOKUPS_PER_SCAN=8  VT_CACHE_TTL_HOURS=24
GEMINI_API_KEY=  GEMINI_MODEL=gemini-3.8-flash
OLLAMA_URL=            # e.g. http://localhost:11434 (optional)
OLLAMA_MODEL=llama3.1:8b
AI_DEFAULT_PROVIDER=ollama  AI_CLOUD_ESCALATION_ENABLED=true  AI_LOCAL_ONLY=false
AI_CLOUD_ALLOWED_DATA_CLASSIFICATION=low,moderate
PHISHING_INTEL_ENABLED=true  PI_SCAN_RATE_PER_HOUR=30
```

Run the cron sweeper every minute in production: `GET /api/cron/process-scans`. Locally, use `npm run cron:run process-scans`.

## Exfiltration: where captured data is sent

Module: `intelligence/exfil-extractor.ts`. Migration: `20261120000019_phishing_intel_exfil.sql`.

**What is read.** The email HTML, the email text, and every HTML, SVG, JS, HTA or MHT attachment (up to 2 MB each), as plain text only. Nothing is rendered, executed or fetched, which keeps hard rule 6.

**Hidden code.** The extractor decodes `atob`/base64, `data:` URIs, long base64 strings, `unescape`/`decodeURIComponent`, `String.fromCharCode`, `\x`/`\u` escapes and HTML entities, up to two layers deep.

| Kind | Detected from | Correlation key |
|---|---|---|
| `telegram_bot` | `api.telegram.org/bot<id>:<token>` or a quoted bot token; the `chat_id` is captured too | `telegram:bot:<id>` |
| `discord_webhook`, `webhook` | Discord, Slack, webhook.site and Pipedream URLs | webhook ID |
| `google_apps_script`, `google_form` | `script.google.com/macros/s/…/exec`, `…/formResponse` | script or form ID |
| `form_service` | Formspree, Getform, FormSubmit, Basin, submit-form, EmailJS | service path |
| `php_handler`, `form_action`, `js_endpoint` | `<form action>`, `fetch`, `$.post`/`$.ajax`, `axios.post`, `XMLHttpRequest`, `sendBeacon`, `.action =` | host + path |
| `mailto` | `<form action="mailto:…">` | address |

**Secrets.** Bot tokens and webhook keys are never stored. Each one is kept only as its ID, a redacted display form (`bot7712…:AAab…_-`) and a SHA-256 for exact matching. They are never used to contact the attacker.

**What it changes downstream.**
- **IOCs.** A new `exfil_endpoint` type with `subtype` and `detail` (source, attachment name, method, encoding, chat id). The destination host also becomes a domain/URL indicator, so VirusTotal checks it, unless it is a shared service such as Telegram or Google.
- **Findings and scoring.**
  - New findings: `exfil_telegram`, `exfil_webhook`, `exfil_google`, `exfil_form_service`, `exfil_php`, `exfil_endpoint`, `exfil_mailto`, `obfuscated_exfil` and `victim_ip_lookup`.
  - Telegram and webhook destinations set a risk floor of 80.
  - Credential-phishing evidence now names the destination.
- **MITRE.** T1567 (Exfiltration Over Web Service), T1567.004 (Exfiltration Over Webhook), T1056.003 (Web Portal Capture) and T1027 when the destination is hidden.
- **Correlation.** Other scans that send data to the same destination are counted live on `/soc/intel/[id]`. A shared endpoint is a strong sign of the same operator.

**Not covered.** Takedown notices addressed to Telegram or Discord are not built yet.

## Landing-page sandbox (urlscan.io)

Modules: `sandbox/sanitize.ts`, `sandbox/urlscan.ts`, `sandbox/landing-processor.ts` and `sandbox/landing-service.ts`. Migration: `20261120000020_landing_analyses.sql` (the table is in Realtime).

**Who starts it.** Only a SOC analyst, from the "Linked page" section on `/soc/intel/[id]`, through the `analyzeLandingPage` Server Action (`soc_analyst` or higher, zod-validated, RLS-checked).
- Only URLs that are already indicators of that scan can be submitted.
- Test domains (`.example`, `.test`…) and private IPs are blocked.

**Rule 6.** The platform never opens the page. urlscan.io renders it in its own sandbox; we send only the URL and read back the result, the DOM and the recorded script bodies.

**Observation only.** Nothing is typed into or submitted on the page.

**Victim privacy.** Before anything leaves the platform, the URL is sanitised:
- e-mail addresses (plain, `%40`-encoded or base64) become `user@example.com`;
- Albanian phone numbers become a placeholder;
- `user:pass@` is removed.

The analyst sees the exact URL that will be sent, and a two-step confirmation shows which visibility will be used (`unlisted` by default).

**Processing.** The processor reuses the exfiltration extractor on the DOM, the site's own scripts (up to 8; CDNs are skipped) and the requests the page made while loading. To avoid noise found on real pages:
- Only credential forms (password, or at least two login/card/OTP/IBAN fields sent by POST) count as data destinations.
- Generic endpoints (a PHP handler, a form action, a script request) are reported only when the page has a credential form. Telegram bots, webhooks, Google scripts/forms and form services are always reported.
- Analytics and telemetry hosts, and URLs built at runtime (`${…}`), are ignored.
- POST requests made while the page loads count only when they go to another site.

Bot tokens and webhook keys are redacted from every stored URL (`redactSecrets`).

**Results.** For each analysis the SOC sees:
- the page (title, IP, network, country, HTTP status, domain age, TLS issuer) and the urlscan verdict and brands;
- the forms, the data destinations and the requests made while loading;
- VirusTotal for the final domain and for the destination hosts;
- links to the urlscan report and screenshot.

Destinations also become `scan_iocs` with location `landing_page`, so KPIs and cross-scan correlation include them.

**Limits and reuse.**
- The same page (host + path) analysed in the last 24 hours is reused and spends no quota.
- Each analyst can run 20 analyses per hour (`URLSCAN_PER_USER_HOUR`); the platform-wide limit is 100 per day (`URLSCAN_DAILY_LIMIT`).
- Results arrive through `after()`. The cron job `poll-landing` finishes any analysis whose poll was cut short.

**Configuration.**
- Key: `URLSCAN_TOTAL_API_KEY`, or `URLSCAN_API_KEY`.
- Optional: `URLSCAN_VISIBILITY` (`unlisted` | `private` | `public`), `URLSCAN_COUNTRY`, `URLSCAN_DAILY_LIMIT`, `URLSCAN_PER_USER_HOUR`.

## SOC view

`/soc/intel` lists every scan with its VirusTotal detections and updates live through Supabase Realtime on `phishing_scans`. Filters: channel, verdict, status, **Albania only** and **VirusTotal detections only**. `/soc/intel/[id]` mirrors the inbox workspace. A scan is in Albania scope when at least one of these signals is present: a +355 sender, an Albanian number in the text, a `.al` domain, an imitated Albanian institution, or text in Albanian. The detail page lists the signals that applied. Migration: `20261120000018_phishing_intel_soc.sql`.

## Not in this MVP

- MSG parsing
- `/smishing/import` and `/integrations/sms-webhook`
- Shortener expansion (it needs an isolated fetch service)
- MISP/OpenCTI feeds
- A labelled evaluation set for calibrating the weights

# Mburoja

Mburoja is an anti-phishing and anti-smishing platform for Albania. A person can check a link, SMS, email, or screenshot without an account and get a plain-language verdict. Banks and institutions watch for lookalike domains. A security operations centre (SOC) triages reports, groups them into campaigns, and prepares takedown notices.

The interface is in Albanian (`sq`, the default) and English (`en`). Every domain and URL is shown defanged (`hxxp://`, `[.]`) until someone chooses to reveal it. Demo data uses hosts that end in `.example` or `.test`. Takedown email is simulated and written to an outbox; it is not sent.

The live app is [https://mburoja.roja-parkingut.workers.dev](https://mburoja.roja-parkingut.workers.dev).

## Who it is for

| Audience | What they can do | Where |
| --- | --- | --- |
| Anyone | Check a message, report one, read the public threat feed, and use the learning pages | `/sq` and `/en` |
| Citizen | See their own checks, reports, watchlist, and alerts | `/[locale]/citizen` |
| Business | Watch brand domains, staff reports, and lookalike notices | `/[locale]/business` |
| SOC analyst | Triage the inbox, campaigns, domains, the map, and the pattern explorer | `/[locale]/soc` |
| SOC lead | The analyst tools, plus approving takedown notices and some exports | same SOC routes |
| Platform admin | Organizations and staff | `/[locale]/admin` |

Platform roles, stored on `profiles.platform_role`, are `user`, `soc_analyst`, `soc_lead`, and `platform_admin`. Organization membership roles are `owner`, `admin`, `security`, `comms`, `finance`, `viewer`, and `contact`. Access is enforced by Postgres row-level security and again in Server Actions and route handlers.

## What a check does

A check scores signals the server already computed. An LLM may explain those signals. It does not make the verdict, and user text is passed only as quoted data.

The live scorer is `fuse()` in `client/src/server/detection/`, version `risk-1` (`client/src/server/detection/scoring/config.ts`). Scores are grouped and capped before any floor is applied. Default flag bands are yellow at 20, orange at 40, red at 60, and dark red at 80. Each colour is always shown with an icon and a word. Grey means the check could not be scored.

The server does not fetch a URL that a user submitted. Screenshot scanning stays on the server. Stored features keep the URL, domain, sender identifier, and signals. Message text is not stored on the pattern explorer.

## Repository layout

The Next.js app is `client/`. There is no separate backend.

```text
.
├── .github/workflows/deploy.yml   # push to main deploys the Worker
├── README.md
└── client/
    ├── src/app/[locale]/          # public, auth, citizen, business, soc, admin
    ├── src/app/api/               # public API, extension, cron, SOC export
    ├── src/server/detection/      # scoring
    ├── src/server/queries/        # database reads
    ├── src/components/            # interface
    ├── messages/sq.json           # Albanian copy (the next-intl source type)
    ├── messages/en.json
    ├── supabase/migrations/       # the only way schema changes
    ├── supabase/tests/database/   # RLS and SQL tests
    ├── extension/                 # Chrome and Firefox extension
    ├── scripts/                   # seed, geo, deploy patches
    ├── docs/SPEC.md               # product spec
    └── wrangler.jsonc             # Cloudflare Worker
```

New user-facing copy has to exist in both message files. `messages/sq.json` is the type source, so a key that exists only in English will fail the type check.

## Stack

- Next.js 16 (App Router, TypeScript) and React 19. Local dev uses Turbopack. `npm run build` uses webpack.
- Supabase for Postgres, Auth, Storage, and Realtime. The browser uses the publishable key. The secret key is read only in server modules.
- Tailwind CSS v4 and shadcn/ui. Charts use Recharts. Tables use TanStack Table. Forms use react-hook-form and Zod.
- next-intl for Albanian and English. next-themes for light and dark.
- Cloudflare Workers through [@opennextjs/cloudflare](https://opennext.js.org/cloudflare). Worker name: `mburoja`.

Node 20.9 or newer. GitHub Actions uses Node 22. The package manager is npm. Run commands from `client/`.

## Run it locally

```bash
cd client
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Albanian is `/sq`, English is `/en`.

`.env.example` lists the optional threat-intel keys. The app also needs the variables in the next section. Put them in `client/.env.local`. Do not commit that file.

For a local database, Docker and the Supabase CLI are required:

```bash
npx supabase start
npm run db:types
npm run seed
```

`npm run seed` needs `DEMO_PASSWORD` in `.env.local`. It creates these accounts when they do not already exist:

| Email | Role |
| --- | --- |
| `citizen@demo.example` | Citizen |
| `analyst@demo.example` | SOC analyst |
| `lead@demo.example` | SOC lead |
| `admin@demo.example` | Platform admin |
| `owner@demo-bank.example` | Business owner of the demo bank |

The hosted project is separate from a local stack. Do not run `npm run db:reset` against it.

## Environment variables

Set these in `client/.env.local` for local work, and as Worker secrets or GitHub Actions secrets for production. Never prefix a secret with `NEXT_PUBLIC_`.

| Name | Where it is used |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server. Required. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser and server. Required. |
| `SUPABASE_SECRET_KEY` | Server only. Seed, admin, and jobs. |
| `APP_URL` | Links in email and metadata. Defaults to `http://localhost:3000`. |
| `DEMO_PASSWORD` | Seed script only. Not read by the app. |
| `CRON_SECRET` | `Authorization: Bearer` for `GET /api/cron/{job}`. |
| `SIMULATE_EMAIL` | Anything other than `false` logs mail instead of sending it. |
| `LLM_PROVIDER` | `gemini` (default) or `anthropic` for the explanation model. |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Gemini explanation. |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Anthropic explanation. |
| `IP_HASH_SALT` | Daily hash of a visitor address. |
| `INTEL_MODE` | `mock` (default) or `live` for VirusTotal, urlscan-style abuse lookup, and Hybrid Analysis. |
| `VIRUS_TOTAL_API_KEY` or `VT_API_KEY` | Reputation lookup when intel is live. |
| `AUTH_ABUSE_API_KEY` | Abuse lookup when intel is live. |
| `HYBRID_ANALYSIS_API_KEY`, `HYBRID_ANALYSIS_ID` | Sandbox lookup when intel is live. |
| `URLSCAN_API_KEY`, `URLSCAN_VISIBILITY`, `URLSCAN_BASE_URL`, `URLSCAN_COUNTRY` | Landing-page sandbox. |
| `PHISHING_INTEL_ENABLED` | Set to `false` to turn the intel pipeline off. |
| `AI_DEFAULT_PROVIDER` | `ollama` (default) or `gemini` inside the phishing-intel explainer. |
| `OLLAMA_URL`, `OLLAMA_MODEL` | Local model for that explainer. |
| `AI_TIMEOUT_MS` | Explainer timeout. Default 15000. |
| `AI_CLOUD_ALLOWED_DATA_CLASSIFICATION` | Which data classes may be sent to a cloud model. Default `low,moderate`. |
| `EXTENSION_ORIGINS` | Extra browser origins allowed to call the extension API, comma-separated. |
| `EXT_REGISTER_PER_HOUR` | Cap on extension installs. Default 5. |
| `PI_SCAN_RATE_PER_HOUR` | Cap on intel scans. Default 30. |

Worker-only secrets stay on the Worker. Deploys pass `--keep-vars` so a deploy does not wipe them. They do not belong in GitHub.

## Routes

Public pages (no account): home, `/check`, `/report`, `/track`, `/threats`, `/learn`, `/institutions`, `/extension`, `/api-docs`, `/contact`, `/privacy`, `/terms`, `/accessibility`.

SOC, after sign-in:

| Path | Page |
| --- | --- |
| `/soc` | Command centre |
| `/soc/inbox` | Triage |
| `/soc/campaigns` | Campaigns |
| `/soc/domains` | Domain intelligence |
| `/soc/geo` | Geographic map |
| `/soc/threat-map` | Pattern explorer |
| `/soc/search` | Search |
| `/soc/intel` | Phishing intel |
| `/soc/takedowns` | Takedown tracker |
| `/soc/advisories` | Advisories |
| `/soc/blocklist` | Blocklist |
| `/soc/alerts` | Alerts |
| `/soc/quality` | Quality |
| `/soc/admin` | SOC admin |

Pattern explorer groups classified checks from the last 7, 30, or 90 days by brand, scam type, and a shared domain, URL, or collection link. It does not chart raw report text. `client/scripts/fill-pattern-features.ts` can backfill connection, nameserver, and place on `.example` and `.test` hosts only:

```bash
npx tsx scripts/fill-pattern-features.ts
```

## HTTP API

Public and extension routes live under `/api/v1`. The OpenAPI document is `GET /api/v1/openapi.json`, and the human page is `/[locale]/api-docs`.

| Method and path | Purpose |
| --- | --- |
| `POST /api/v1/scan` | Score a message or URL |
| `POST /api/v1/scan/image` | Score a screenshot |
| `GET /api/v1/stats/public` | Public aggregates |
| `GET /api/v1/feed` | Public threat feed |
| `POST /api/v1/reports` | File a report |
| `GET /api/v1/reports/{protocol}` | Look up a report |
| `POST /api/v1/extension/register` | Install token for the extension |
| `GET /api/cron/{job}` | Scheduled job. Requires `CRON_SECRET` |

Cron job names: `compute-geo-hotspots`, `rebuild-region-stats`, `poll-deep-scans`, `escalate-overdue`, `evaluate-alerts`, `detect-lookalikes`, `cluster-campaigns`, `refresh-kpis`, `purge-privacy`, `process-scans`, `poll-landing`.

Phishing-intelligence routes live under `/api/phishing-intelligence`. SOC CSV and JSON export is `GET /api/soc/export/{table}` and requires an analyst session.

## Browser extension

Chrome and Firefox. It scans only after a click, holds no provider keys, and stores an install token from `/api/v1/extension/register`. Build and load instructions are in [client/extension/README.md](client/extension/README.md).

```bash
cd client
npm run ext:build
npm run ext:typecheck
```

## Scripts

Run from `client/`.

| Script | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build (webpack) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest |
| `npm run test:e2e` | Playwright |
| `npm run db:test` | SQL tests against the linked remote database |
| `npm run db:types` | Regenerate `src/types/database.ts` |
| `npm run seed` | Synthetic institutions, campaigns, reports, and demo users |
| `npm run staff:create` | Create a staff account |
| `npm run cron:run` | Run a job locally |
| `npm run geo:build` | Rebuild map boundaries |
| `npm run preview` | Build and preview the Cloudflare Worker locally |
| `npm run deploy` | Build and deploy the Worker |

Schema changes go in a new file under `client/supabase/migrations/`. After it is applied, regenerate types. Do not edit `src/types/database.ts` by hand.

## Tests

```bash
cd client
npm test
npx vitest run src/server/queries/pattern-summary.test.ts
npm run db:test
```

Scoring behaviour is locked by the unit tests next to `src/server/detection/scoring/`. Database policies are locked by `supabase/tests/database/`.

## Deploy

Production is a Cloudflare Worker. Public pages are prerendered and served from Worker assets so they stay inside the free-plan CPU limit. Signed-in SOC pages still run the Next.js server and are much heavier.

From `client/`, after `npx wrangler login`:

```bash
npm run deploy -- --keep-vars
```

`--keep-vars` keeps Worker secrets. The first deploy can omit it. The script patches the OpenNext cookie import, builds, copies prerendered HTML into assets, and deploys.

A push to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). The production environment URL is the Workers address above. These Actions secrets are required:

| Secret | Purpose |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Deploy. Account scope only: Workers Scripts Edit, Account Settings Read, Cloudflare Images Edit. No zone permissions. |
| `CLOUDFLARE_ACCOUNT_ID` | The Workers account |
| `NEXT_PUBLIC_SUPABASE_URL` | Baked into the build |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Baked into the build |

Create the token at [Cloudflare API tokens](https://dash.cloudflare.com/profile/api-tokens) for the account that owns the `mburoja` Worker, then store it under the repository's Actions secrets. Do not put the global API key, a Wrangler OAuth token, `SUPABASE_SECRET_KEY`, or `GEMINI_API_KEY` in GitHub. Those stay on the Worker.

## Do not commit

- `client/.env.local`, `client/.dev.vars`, and any other file with keys
- `client/.open-next/` and `client/.next/`
- `client/node_modules/` and a `package.json` accidentally created at the repository root
- Extension build output under `client/extension/dist/` and `client/public/downloads/`

`.env.example` is the only env file that belongs in git.

## Further reading

- [client/docs/SPEC.md](client/docs/SPEC.md) is the product spec: panels, schema, scoring, and privacy rules.
- [client/docs/PHISHING-INTEL.md](client/docs/PHISHING-INTEL.md) covers the intel pipeline.
- [client/extension/README.md](client/extension/README.md) covers the browser extension.

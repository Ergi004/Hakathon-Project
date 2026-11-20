# Mburoja: Full Build Prompt (Next.js + Supabase + shadcn/ui)

Nov 20, 2026 · @Ergi

## 0. How to use this document

This document is the spec for the whole platform. Use it in three steps.

1. Export it as Markdown and save it in the repo as `docs/SPEC.md`.
2. Paste the **Master prompt** (section 1) into `CLAUDE.md` at the repo root so every Claude Code session starts with the same rules.
3. Run the **phase prompts** in section 16 one at a time. Each phase says which sections of this spec to read, what to build and how to check it.

The stack is Next.js only, with Supabase for database, auth, storage, realtime and scheduled jobs, and shadcn/ui for the interface. There is no separate backend. Server logic lives in Server Components, Server Actions and Route Handlers.

**Starting point:** a Next.js project already exists and uses **npm**. Nothing else is installed. Section 2 has the exact commands to add shadcn/ui, Supabase and the tooling to it, and phase 0 in section 16 tells Claude Code to inspect your project first instead of creating a new one. Anywhere the spec says `supabase <command>`, run `npx supabase <command>`; anywhere it says to run a script, use `npm run <script>`.

Product scope, panels and features come from the panels document: [Mburoja (S-04): Panels and Features](https://claude.ai/artifact/X7BEpCgSPMBBjs6uAeEfuD). Panel IDs used below (A1 to A15, C1 to C12, B1 to B12) refer to it.

## 1. Master prompt (paste into CLAUDE.md)

```markdown
# Role

You are a senior full-stack engineer and product designer building **Mburoja**, an anti-fraud platform for Albania. Build it to a quality a security agency could pilot.

# Product

Mburoja detects fake government, bank, postal and utility messages, domains and emails.

- Citizens check a link, SMS, email or screenshot and get a verdict with plain-language reasons.
- Businesses monitor lookalike domains that imitate their brand and protect their staff.
- Authorities (a SOC) triage reports, group them into campaigns, extract indicators of compromise (IoCs) and send takedown notices.
- A Chrome extension scans emails the user chooses and reports suspicious ones.
  The full spec is in docs/SPEC.md. Read the sections named in each task before coding. Do not invent features that are not in the spec; ask first.

# Stack (fixed)

- Next.js (latest stable, App Router, TypeScript strict). No separate backend: use Server Components, Server Actions and Route Handlers.
- Supabase: Postgres, Auth, Storage, Realtime, pg_cron, Edge Functions only if a job cannot run in Next.
- shadcn/ui on Tailwind CSS v4 (CSS-first config, no tailwind.config.js), lucide-react icons, next-themes, sonner toasts, recharts for charts, @tanstack/react-table for tables, react-hook-form + zod for forms, next-intl for i18n (sq default, en).
- Package manager: npm (lockfile: package-lock.json; never add pnpm or yarn files). The Next.js project already exists in the repo root: never re-scaffold it and never run create-next-app. Run Supabase CLI commands as `npx supabase ...`. Node 20.9 or newer.

# Hard rules

1. Authorization is enforced in the database (Row Level Security on every table) and again in every Server Action and Route Handler. Never rely on proxy.ts alone for access control.
2. Browser code uses only the Supabase publishable key. The secret key is read only in server-only modules (`import 'server-only'`) and never prefixed with NEXT*PUBLIC*.
3. Use `@supabase/ssr` clients. In server code verify the user with `supabase.auth.getUser()`, not by trusting a cookie.
4. Validate every input with zod on the server. Return typed results, never throw raw database errors to the client.
5. Privacy: citizens never need an account. Mask phone numbers, IBANs, ID numbers, emails and names before storing any message text. Show every domain and URL defanged by default (`hxxp://`, `[.]`).
6. The server never fetches a user-submitted URL. Any future live-page analysis must go through an isolated service.
7. LLM calls receive user text only as quoted data inside a fixed prompt, and an LLM never makes the final verdict: it explains signals the scoring engine already computed.
8. Accessibility: WCAG AA, keyboard navigation, visible focus. Flag colours always come with an icon and a word.
9. All data is synthetic (domains end in .example or .test). Sending takedown notices is simulated and logged.
10. Next.js 16 conventions: `proxy.ts` instead of `middleware.ts`, `await params` and `await searchParams`, `use cache` only where the spec says.

# Conventions

- Folder layout and naming exactly as in spec section 2.
- Database changes only through SQL migrations in supabase/migrations. Regenerate types with `supabase gen types typescript` after each migration.
- UI strings live in messages/sq.json and messages/en.json. No hard-coded user-facing text.
- Small commits with clear messages. Add a test for scoring logic and for every RLS policy that matters.

# Definition of done for any task

It type-checks, lints, runs locally against a local Supabase, works in Albanian and English, works on a 375 px wide screen, respects RLS (test with a different role), and the page or feature matches the spec section named in the task.
```

## 2. Stack, versions and project structure

The Next.js project already exists (created with `create-next-app`) and **npm** is the package manager. Nothing else is set up yet: no shadcn, no Supabase, no extra packages. Checked on 20 November 2026 against official sources. The rules below assume Next.js 16 conventions, so run `npx next --version` first; if it prints a different major version, read that version's upgrade notes before continuing.

| Item            | What to use                                                                                                                                                                                  | Notes                                                                                                                                                                                                                                                                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js         | 16.x, App Router, Turbopack (default)                                                                                                                                                        | Needs Node 20.9 or newer. `params` and `searchParams` are async. `proxy.ts` replaces `middleware.ts`. Cache Components (`use cache`) is opt-in with `cacheComponents: true` in `next.config.ts`. A May 2026 security release fixed middleware and proxy bypass issues, so install the latest patch and never use proxy.ts as the only access check |
| Supabase keys   | Publishable key (`sb_publishable_...`) in the browser, secret key (`sb_secret_...`) on the server only                                                                                       | These replace the legacy `anon` and `service_role` keys, which Supabase is deprecating by the end of 2026. RLS policies are written for the `anon` and `authenticated` roles and never apply to the secret key                                                                                                                                     |
| Supabase client | `@supabase/supabase-js` and `@supabase/ssr`                                                                                                                                                  | Browser, server and proxy clients as in the folder layout below                                                                                                                                                                                                                                                                                    |
| UI              | shadcn/ui via `npx shadcn@latest init`, Tailwind CSS v4                                                                                                                                      | Tailwind v4 has no `tailwind.config.js`; theme tokens live in `globals.css` under `@theme inline`. Use `tw-animate-css` for animations                                                                                                                                                                                                             |
| Other libraries | zod, react-hook-form, @hookform/resolvers, next-intl, next-themes, recharts, @tanstack/react-table, date-fns, papaparse, tldts, fastest-levenshtein, jszip, @react-pdf/renderer, server-only | Domain parsing with `tldts`, punycode with Node's `url.domainToUnicode`                                                                                                                                                                                                                                                                            |
| LLM             | `@google/genai` (Gemini) or `@anthropic-ai/sdk`, chosen by `LLM_PROVIDER`                                                                                                                    | Behind one wrapper in `src/server/llm.ts`                                                                                                                                                                                                                                                                                                          |
| Email           | Nodemailer or Resend, behind a `SIMULATE_EMAIL` flag                                                                                                                                         | Default on for the demo: log instead of send                                                                                                                                                                                                                                                                                                       |
| Testing         | vitest, playwright, supabase CLI for local DB                                                                                                                                                |                                                                                                                                                                                                                                                                                                                                                    |

**Setup commands**

Run everything from the root of your existing project (the folder with `package.json`).

**Step 1. Check what you have**

```bash
node -v                      # must be 20.9 or newer
npx next --version           # expect 16.x
npm ls tailwindcss typescript eslint --depth=0
ls                           # is there a src/ folder? is app/ inside it?
```

The spec uses the layout `src/app/...`, `src/server/...`, `src/components/...` and the import alias `@/*`. If your project has `app/` at the root instead of `src/app/`, move it: `mkdir src && git mv app src/app` (and `components`, `lib` if present), then make sure `tsconfig.json` has `"paths": { "@/*": ["./src/*"] }`. If Tailwind is older than v4 or missing, run `npm install tailwindcss @tailwindcss/postcss postcss` and follow the shadcn Tailwind v4 page before the next step.

**Step 2. shadcn/ui**

```bash
npx shadcn@latest init
npx shadcn@latest add button card input textarea label select checkbox switch tabs table dialog sheet drawer dropdown-menu popover command tooltip badge avatar separator skeleton sonner form calendar chart sidebar breadcrumb progress alert accordion scroll-area resizable toggle-group navigation-menu pagination hover-card collapsible radio-group slider
```

Choose the neutral base colour and CSS variables when asked. The init command installs `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge` and `tw-animate-css` by itself.

**Step 3. Runtime packages**

```bash
npm install @supabase/supabase-js @supabase/ssr zod react-hook-form @hookform/resolvers next-intl next-themes recharts @tanstack/react-table date-fns papaparse tldts fastest-levenshtein jszip @react-pdf/renderer server-only @google/genai @anthropic-ai/sdk nodemailer
```

If npm stops with an `ERESOLVE` peer-dependency error (common when a library has not declared React 19 support yet), rerun the same command with `--legacy-peer-deps` and keep using that flag for later installs, or add a project `.npmrc` file containing `legacy-peer-deps=true`.

**Step 4. Dev tools**

```bash
npm install -D vitest @playwright/test supabase tsx @types/papaparse @types/nodemailer
npx playwright install chromium
npx supabase init
npx supabase start        # needs Docker Desktop running; prints the local URL and keys
```

The `supabase` CLI is installed as a dev dependency, so **wherever this spec writes `supabase <command>`, run `npx supabase <command>`** (or the npm script below).

**Step 5. npm scripts** (merge into the `scripts` section of `package.json`; keep the ones create-next-app already made)

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "db:start": "supabase start",
    "db:reset": "supabase db reset",
    "db:test": "supabase test db",
    "db:types": "supabase gen types typescript --local > src/types/database.ts",
    "seed": "tsx scripts/seed.ts",
    "train": "tsx scripts/train-classifier.ts",
    "cron:run": "tsx scripts/cron-run.ts"
  }
}
```

If `npm run lint` reports that `next lint` is missing (newer Next.js versions removed it), change the script to `eslint .`. `tsx` is used for the seed, training and cron scripts because they are plain TypeScript files that run outside Next.js; load `.env.local` in them with `import 'dotenv/config'` after `npm install -D dotenv`, or run with `node --env-file=.env.local --import tsx scripts/seed.ts`.

**Step 6. Commit**

`git add -A && git commit -m "chore: add shadcn, supabase and tooling"` so the next phase starts from a clean tree.

**Environment variables** (`.env.local`)

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
APP_URL=http://localhost:3000
LLM_PROVIDER=gemini
GEMINI_API_KEY=
ANTHROPIC_API_KEY=
CRON_SECRET=
SIMULATE_EMAIL=true
```

**Folder layout**

```text
<your-project>/   (your existing Next.js repo root)
  docs/SPEC.md
  CLAUDE.md
  supabase/
    migrations/            SQL migrations (section 5)
    seed/                  CSV loaders and seed.sql (section 14)
    config.toml
  extension/               Chrome extension, separate package (section 12)
  messages/sq.json en.json
  src/
    proxy.ts               session refresh only
    app/
      [locale]/
        (public)/          homepage, check, report, feed, domain, learn
        (auth)/            login, register, reset
        citizen/           dashboard C1-C12
        business/          dashboard B1-B12
        soc/               authorities dashboard A1-A15
        admin/             platform admin
      api/
        v1/                public and extension API (section 13)
        cron/              scheduled jobs
    components/
      ui/                  shadcn components
      brand/ flags/ charts/ tables/ layout/
    server/
      supabase/ (client.ts server.ts admin.ts proxy.ts)
      detection/ (score.ts url.ts domain.ts message.ts email.ts masks.ts campaigns.ts)
      takedown/ (templates.ts fill.ts evidence.ts)
      llm.ts  email.ts  audit.ts  rate-limit.ts
    lib/                   utils, zod schemas, constants
    types/                 database.ts (generated)
```

Sources: [Next.js 16 release](https://nextjs.org/blog/next-16), [InfoQ on Next.js 16 breaking changes](https://www.infoq.com/news/2025/12/nextjs-16-release), [Vercel May 2026 Next.js security release](https://vercel.com/changelog/next-js-may-2026-security-release), [Supabase API keys](https://supabase.com/docs/guides/api/api-keys), [Supabase migration to new keys](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys), [Supabase SSR client for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs?router=app), [shadcn/ui Next.js install](https://ui.shadcn.com/docs/installation/next), [shadcn/ui Tailwind v4](https://ui.shadcn.com/docs/tailwind-v4).

## 3. Design system

**Concept: calm control room.** A dark-first, high-contrast interface with a cyan shield accent and a sparing red for danger, so a frightened citizen sees calm and a SOC analyst sees density. Light mode is supported everywhere. The look is clean, not decorative: glass-like cards, a faint grid background, soft glows around the hero checker and score rings, and motion only where it explains something.

### Brand

- Name: Mburoja ("the shield"). Logo: an abstract shield with a check mark cut out by a scan line. Do not use the national emblem or any real institution's logo.
- Voice: short, plain Albanian first, English second. Never blame the user. Say what to do next.

### Tokens

Put these in `src/app/globals.css` using the shadcn Tailwind v4 structure (`:root`, `.dark`, and `@theme inline`).

```css
:root {
  --radius: 0.75rem;
  --background: oklch(0.985 0.003 250);
  --foreground: oklch(0.2 0.03 260);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.2 0.03 260);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.2 0.03 260);
  --primary: oklch(0.55 0.12 215);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.96 0.01 250);
  --secondary-foreground: oklch(0.25 0.03 260);
  --muted: oklch(0.96 0.008 250);
  --muted-foreground: oklch(0.5 0.02 260);
  --accent: oklch(0.94 0.02 230);
  --accent-foreground: oklch(0.25 0.03 260);
  --destructive: oklch(0.58 0.23 27);
  --border: oklch(0.91 0.01 250);
  --input: oklch(0.91 0.01 250);
  --ring: oklch(0.55 0.12 215);
  --chart-1: oklch(0.65 0.13 210);
  --chart-2: oklch(0.7 0.15 160);
  --chart-3: oklch(0.78 0.15 85);
  --chart-4: oklch(0.65 0.2 25);
  --chart-5: oklch(0.6 0.15 290);
  --flag-green: oklch(0.62 0.17 150);
  --flag-yellow: oklch(0.8 0.16 95);
  --flag-orange: oklch(0.7 0.18 55);
  --flag-red: oklch(0.58 0.23 27);
  --flag-darkred: oklch(0.42 0.2 22);
  --flag-grey: oklch(0.6 0.01 260);
}
.dark {
  --background: oklch(0.16 0.02 260);
  --foreground: oklch(0.97 0.005 260);
  --card: oklch(0.2 0.025 260);
  --card-foreground: oklch(0.97 0.005 260);
  --popover: oklch(0.2 0.025 260);
  --popover-foreground: oklch(0.97 0.005 260);
  --primary: oklch(0.78 0.13 195);
  --primary-foreground: oklch(0.18 0.03 230);
  --secondary: oklch(0.26 0.03 260);
  --secondary-foreground: oklch(0.97 0.005 260);
  --muted: oklch(0.26 0.025 260);
  --muted-foreground: oklch(0.7 0.02 260);
  --accent: oklch(0.3 0.04 250);
  --accent-foreground: oklch(0.97 0.005 260);
  --destructive: oklch(0.65 0.23 27);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 14%);
  --ring: oklch(0.78 0.13 195);
  --flag-green: oklch(0.74 0.17 150);
  --flag-yellow: oklch(0.86 0.16 95);
  --flag-orange: oklch(0.76 0.17 55);
  --flag-red: oklch(0.65 0.23 27);
  --flag-darkred: oklch(0.5 0.21 22);
  --flag-grey: oklch(0.68 0.01 260);
}
```

Register `--flag-*` colours in `@theme inline` so classes like `bg-flag-red` and `text-flag-green` exist.

### Type and shape

| Item                        | Choice                                                                                        |
| --------------------------- | --------------------------------------------------------------------------------------------- |
| UI font                     | Geist Sans (from create-next-app)                                                             |
| Display headings            | Space Grotesk, weights 500 and 700, loaded with `next/font`                                   |
| Mono (domains, IoCs, codes) | Geist Mono                                                                                    |
| Scale                       | 12, 14, 16, 18, 20, 24, 30, 36, 48, 60 px; body 16 px on public pages, 14 px in dashboards    |
| Radius                      | 12 px cards, 8 px inputs and buttons, full for badges                                         |
| Elevation                   | Borders first, shadows rarely; glow only on the hero checker and the score ring               |
| Spacing                     | 4 px grid; page padding 16 px mobile, 32 px desktop                                           |
| Motion                      | 150 to 250 ms ease-out; score ring and counters animate once; honour `prefers-reduced-motion` |

### Signature components (build these once, reuse everywhere)

| Component                                                                                                          | What it does                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `ScoreRing`                                                                                                        | SVG ring 0 to 100 with the flag colour, number in the centre, animated sweep, three sizes                                             |
| `FlagBadge`                                                                                                        | Pill with icon, word and score: Green Safe, Yellow Careful, Orange Suspicious, Red Likely scam, Dark red Known scam, Grey Not scanned |
| `ReasonList`                                                                                                       | Two to four reasons, each with an icon for its signal group (link, content, sender, attachment, reputation)                           |
| `DefangedText`                                                                                                     | Mono text shown defanged, with Copy and an explicit Reveal toggle                                                                     |
| `MaskedText`                                                                                                       | Message text with masked parts shown as chips and trigger phrases highlighted                                                         |
| `IocTable`                                                                                                         | Table of domains, URLs, IPs, certificates with copy all and export CSV or JSON                                                        |
| `StatusTimeline`                                                                                                   | Vertical or horizontal pipeline for reports, campaigns and notices, with timestamps                                                   |
| `KpiTile`                                                                                                          | Number, label, trend arrow, sparkline                                                                                                 |
| `CampaignCard`                                                                                                     | Campaign ID, institution, tactic, dates, counts, status                                                                               |
| `NoticePreview`                                                                                                    | Albanian and English side by side with locked fields highlighted                                                                      |
| `FilterBar`                                                                                                        | Filter chips, search, saved views                                                                                                     |
| `DataTable`                                                                                                        | TanStack table with sticky header, density toggle, column menu, row opens a right-hand `Sheet`                                        |
| `SeverityDot`, `EmptyState`, `PageHeader`, `CopyButton`, `LanguageSwitch`, `ThemeToggle`, `CommandPalette` (Cmd K) | Shared building blocks                                                                                                                |

### Layout per area

| Area               | Layout                                                                                                                                                                                | Feel                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Public site        | Sticky top bar, full-width sections, hero with a large glowing "command bar" checker (tabs: Link, Message, Email, Screenshot) and clickable example chips using real dataset messages | Calm, spacious, reassuring    |
| Citizen dashboard  | shadcn `Sidebar` that collapses to icons; bottom tab bar on mobile; cards and big buttons                                                                                             | Friendly, large touch targets |
| Business dashboard | Sidebar plus top bar with a brand switcher and a notifications bell; widgets in a grid                                                                                                | Professional, report-like     |
| Authorities (SOC)  | Dark by default; sidebar, then a list pane, then a detail `Sheet`; keyboard shortcuts; a thin status bar at the bottom showing ingestion health and last sync                         | Dense, fast, control-room     |
| Admin              | Simple sidebar with forms and tables                                                                                                                                                  | Plain                         |

### Backgrounds and details

- Hero: a faint 1 px grid with a radial cyan glow behind the checker and a slow scan line over the shield logo.
- Cards: `bg-card/70 backdrop-blur border border-border`, lift by 2 px on hover.
- Charts: recharts through the shadcn `chart` component, using `--chart-*` and `--flag-*` colours; always label axes and add a text summary for screen readers.
- Empty, loading and error states are designed for every list and card (skeletons, never spinners alone).
- Flags never rely on colour alone: icon plus word plus score on every use.

## 4. Auth, roles, tenancy and access rules

### Identity model

- Supabase Auth holds users. A trigger creates a `profiles` row for each new user.
- `profiles.platform_role` is one of `user`, `soc_analyst`, `soc_lead`, `platform_admin`. Citizens and business users are `user`.
- Businesses and institutions are `organizations`. A user belongs to an organization through `organization_members.role`: `owner`, `admin`, `security`, `comms`, `finance`, `viewer`, `contact` (institution read-only contact).
- Anonymous visitors have no database access at all. Public features (checker, report form, status page, threat feed) go through Route Handlers that use the server-side secret key, validate with zod, mask data and rate-limit by IP hash.

### Sign-in

| Who                 | Methods                                         | Extra                                                                                                   |
| ------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Citizen             | Email and password, magic link, Google          | Optional; the product works without an account                                                          |
| Business            | Email and password, Google, Microsoft later     | Sign-up creates an organization and makes the user `owner`                                              |
| SOC and admin staff | Email and password, invited by a platform admin | TOTP two-factor (Supabase MFA) required for `soc_lead` and `platform_admin`; staff cannot self-register |

### Where access is enforced (all three, always)

1. **Database:** Row Level Security on every table, written for `anon` and `authenticated`. The secret key bypasses RLS, so it is used only in server-only code for public endpoints, jobs and cross-tenant tasks, and every such call writes an `audit_log` entry.
2. **Server code:** every Server Action and Route Handler starts with a guard from `src/server/auth.ts`: `requireUser()`, `requireRole('soc_analyst')`, `requireOrgRole(orgId, ['owner','security'])`. Guards call `supabase.auth.getUser()` and read the role from the database, not from the client.
3. **Routes:** layouts for `/citizen`, `/business`, `/soc` and `/admin` call the guard and redirect. `proxy.ts` only refreshes the session cookie and does a cheap redirect for signed-out users; it is never the only check.

### Access matrix

| Data                                      | Anonymous                     | Citizen        | Business member                     | Institution contact        | SOC analyst    | SOC lead         | Platform admin   |
| ----------------------------------------- | ----------------------------- | -------------- | ----------------------------------- | -------------------------- | -------------- | ---------------- | ---------------- |
| Own profile, own checks, own reports      | n/a                           | Read and write | Read and write                      | Read and write             | Read and write | Read and write   | Read and write   |
| Public threat feed, official domains      | Read through public endpoints | Read           | Read                                | Read                       | Read           | Read and publish | Read and publish |
| All reports, messages, campaigns, domains | None                          | None           | None                                | None                       | Read and write | Read and write   | Read             |
| Campaigns that imitate my organization    | None                          | None           | Read (my brand only)                | Read (my institution only) | Read and write | Read and write   | Read             |
| Brand assets, monitoring alerts of my org | None                          | None           | Read and write by role              | Read                       | Read           | Read             | Read             |
| Takedown notices                          | None                          | None           | Read and create requests for my org | Read for my institution    | Draft, edit    | Approve and send | Read             |
| Extension signal reports                  | Created through the API       | Own only       | Org aggregates only                 | None                       | Read           | Read             | Read             |
| Templates, thresholds, recipients, users  | None                          | None           | None                                | None                       | Read           | Read             | Read and write   |
| Audit log                                 | None                          | None           | Own org                             | None                       | Read           | Read             | Read             |

### Server helpers (spec)

```ts
// src/server/auth.ts  (server-only)
export async function requireUser(): Promise<{ user: User; profile: Profile }>;
export async function requireRole(
  min: "soc_analyst" | "soc_lead" | "platform_admin",
): Promise<Ctx>;
export async function requireOrgRole(
  orgId: string,
  roles: OrgRole[],
): Promise<Ctx>;
// Each helper: getUser() -> load profile / membership -> throw redirect or ForbiddenError.
```

## 5. Database schema (Supabase SQL migrations)

Create these as files in `supabase/migrations/` in the order shown, then run `supabase db reset` and `supabase gen types typescript --local > src/types/database.ts`. Conventions: `uuid` primary keys with `gen_random_uuid()`, `timestamptz` everywhere, `text` with checks instead of free enums when values may grow, RLS enabled on every table, domains stored lower-case and defanged only in the UI.

### 0001_base.sql: enums, helpers, identity

```sql
create extension if not exists pg_trgm with schema extensions;

create type public.app_platform_role as enum ('user','soc_analyst','soc_lead','platform_admin');
create type public.org_type as enum ('business','institution','soc');
create type public.org_member_role as enum ('owner','admin','security','comms','finance','viewer','contact');
create type public.msg_channel as enum ('sms','email','social','web','qr','call','other');
create type public.msg_label as enum ('phishing','legitimate','unknown');
create type public.flag_level as enum ('green','yellow','orange','red','darkred','grey');
create type public.report_source as enum ('citizen_check','citizen_report','extension','feed','business','import');
create type public.report_status as enum ('received','under_review','confirmed','not_scam','takedown_requested','taken_down','duplicate');
create type public.campaign_status as enum ('monitoring','confirmed','takedown_in_progress','resolved');
create type public.domain_class as enum ('typosquat','homoglyph','combosquat','legitimate','unknown');
create type public.ioc_type as enum ('domain','url','ip','cert','phone','email','file_hash');
create type public.notice_type as enum ('registrar','hosting','akcesk');
create type public.notice_status as enum ('draft','in_review','approved','sent','acknowledged','taken_down','no_response','rejected');
create type public.severity as enum ('low','medium','high','critical');

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  locale text not null default 'sq' check (locale in ('sq','en')),
  platform_role public.app_platform_role not null default 'user',
  safety_score int not null default 0 check (safety_score between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name) values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  type public.org_type not null,
  name text not null,
  slug text not null unique,
  country text not null default 'AL',
  plan text not null default 'free' check (plan in ('free','pro','enterprise')),
  created_at timestamptz not null default now()
);
create table public.organization_members (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.org_member_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

-- Access helpers used by every policy. security definer + empty search_path.
create function public.platform_role() returns public.app_platform_role
language sql stable security definer set search_path = '' as $$
  select platform_role from public.profiles where id = (select auth.uid())
$$;
create function public.is_staff() returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.platform_role() in ('soc_analyst','soc_lead','platform_admin'), false)
$$;
create function public.is_lead() returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.platform_role() in ('soc_lead','platform_admin'), false)
$$;
create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(public.platform_role() = 'platform_admin', false)
$$;
create function public.org_role(p_org uuid) returns public.org_member_role
language sql stable security definer set search_path = '' as $$
  select role from public.organization_members where org_id = p_org and user_id = (select auth.uid())
$$;
create function public.is_org_member(p_org uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.organization_members where org_id = p_org and user_id = (select auth.uid()))
$$;
```

### 0002_detection_data.sql: institutions, campaigns, domains, messages, IoCs

```sql
create table public.institutions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  sector text not null default 'other' check (sector in ('government','municipality','bank','postal','utility','telecom','police','other')),
  organization_id uuid references public.organizations(id) on delete set null,
  created_at timestamptz not null default now()
);
create table public.official_domains (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  domain text not null unique check (domain = lower(domain)),
  verified boolean not null default true
);
create table public.official_channels (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  kind text not null check (kind in ('sms_sender','phone','social','email')),
  value text not null,
  unique (kind, value)
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                 -- F019 for dataset campaigns, C-2026-0001 for detected
  tactic text not null,
  institution_id uuid references public.institutions(id),
  imitated_name text,
  first_seen date,
  last_seen date,
  message_count int not null default 0,
  status public.campaign_status not null default 'monitoring',
  severity public.severity not null default 'medium',
  owner_id uuid references public.profiles(id),
  summary text,
  is_public boolean not null default false,
  source text not null default 'dataset' check (source in ('dataset','detected','manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger campaigns_updated before update on public.campaigns for each row execute function public.set_updated_at();
create index on public.campaigns (institution_id, status);

create table public.domains (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique check (domain = lower(domain)),
  class public.domain_class not null default 'unknown',
  imitates_domain text,
  imitates_institution_id uuid references public.institutions(id),
  rule text,
  registered_at date,
  age_days int,
  registrar text,
  nameserver text,
  hosting_country text,
  privacy boolean,
  in_ct_log boolean not null default false,
  risk_score int check (risk_score between 0 and 100),
  status text not null default 'watching' check (status in ('watching','threat','dismissed','taken_down','allowlisted')),
  first_seen_at timestamptz not null default now()
);
create index on public.domains (class, status);
create index on public.domains (imitates_institution_id);
create table public.campaign_domains (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  domain_id uuid not null references public.domains(id) on delete cascade,
  primary key (campaign_id, domain_id)
);
create table public.certificates (
  cert_id text primary key,
  domain_id uuid references public.domains(id) on delete cascade,
  san text[] not null default '{}',
  issuer text,
  not_before date,
  not_after date,
  label public.domain_class,
  imitated_domain text,
  campaign_id uuid references public.campaigns(id) on delete set null
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,                   -- M00001 from the dataset
  channel public.msg_channel not null,
  language text not null check (language in ('sq','en')),
  sender_masked text,
  subject text,
  body_masked text not null,
  body_hash text not null,
  urls text[] not null default '{}',         -- stored defanged
  label public.msg_label not null default 'unknown',
  score int check (score between 0 and 100),
  flag public.flag_level,
  campaign_id uuid references public.campaigns(id) on delete set null,
  institution_id uuid references public.institutions(id),
  tactic text,
  template_id text,
  received_at timestamptz,
  source text not null default 'dataset',
  created_at timestamptz not null default now()
);
create index on public.messages (campaign_id);
create index on public.messages (body_hash);
create index on public.messages using gin (body_masked extensions.gin_trgm_ops);

create table public.iocs (
  id uuid primary key default gen_random_uuid(),
  type public.ioc_type not null,
  value text not null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  source text not null default 'system',
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  unique (type, value)
);

-- Hash lookup for the anonymous checker. No message text is kept for ordinary checks.
create table public.known_hashes (
  hash text primary key,
  kind text not null check (kind in ('url','domain','text','phone')),
  flag public.flag_level not null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  seen_count int not null default 1,
  last_seen timestamptz not null default now()
);
```

### 0003_workflow.sql: reports, takedowns, business, operations

```sql
-- Protocol numbers: SOC-2026/000123
create sequence public.protocol_seq start 1;
create function public.next_protocol() returns text language sql security definer set search_path = '' as $$
  select 'SOC-' || extract(year from now())::int || '/' || lpad(nextval('public.protocol_seq')::text, 6, '0')
$$;

-- Citizen checks: anonymous, hash only. No text, no user id.
create table public.checks (
  id uuid primary key default gen_random_uuid(),
  input_kind text not null check (input_kind in ('url','text','phone','qr','email_signals')),
  input_hash text not null,
  score int not null check (score between 0 and 100),
  flag public.flag_level not null,
  reasons jsonb not null default '[]',          -- [{code, weight, text_sq, text_en}]
  campaign_id uuid references public.campaigns(id) on delete set null,
  model_version text,
  created_at timestamptz not null default now()
);
create index on public.checks (input_hash);
create index on public.checks (created_at desc);

-- Reports: what staff triage. Masked content only.
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  protocol text not null unique default public.next_protocol(),
  source public.report_source not null,
  status public.report_status not null default 'received',
  channel public.msg_channel,
  score int check (score between 0 and 100),
  flag public.flag_level,
  reasons jsonb not null default '[]',
  message_id uuid references public.messages(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  reporter_id uuid references public.profiles(id) on delete set null,   -- null for anonymous
  reporter_org_id uuid references public.organizations(id) on delete set null,
  reporter_contact text,                         -- optional, masked, only if the citizen wants feedback
  tracking_token_hash text,                      -- citizen follows status with the raw token
  consent_signal_report boolean not null default false,
  assigned_to uuid references public.profiles(id),
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger reports_updated before update on public.reports for each row execute function public.set_updated_at();
create index on public.reports (status, flag, created_at desc);
create index on public.reports (campaign_id);
create index on public.reports (reporter_id);
create index on public.reports (reporter_org_id);

create table public.report_events (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  kind text not null,                            -- status_change, assigned, note, linked_campaign
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.report_events (report_id, created_at);

create table public.campaign_notes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

-- Extension
create table public.extension_installs (
  id uuid primary key default gen_random_uuid(),
  install_hash text not null unique,             -- random id generated by the extension, hashed
  user_id uuid references public.profiles(id) on delete set null,
  auto_submit boolean not null default false,
  consent_at timestamptz,
  version text,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create table public.extension_reports (
  id uuid primary key default gen_random_uuid(),
  install_id uuid not null references public.extension_installs(id) on delete cascade,
  report_id uuid not null references public.reports(id) on delete cascade,
  signals jsonb not null,                        -- masked signal report, see section 12
  created_at timestamptz not null default now()
);

-- Takedown
create table public.recipients (
  id uuid primary key default gen_random_uuid(),
  kind public.notice_type not null,
  name text not null,                            -- e.g. registrar name, hosting provider, AKCESK
  abuse_email text not null,                     -- use *.example addresses in the demo
  match_pattern text,                            -- registrar / hosting string to match against whois
  sla_hours int not null default 24
);
create table public.templates (
  id uuid primary key default gen_random_uuid(),
  kind public.notice_type not null,
  locale text not null check (locale in ('sq','en')),
  version int not null default 1,
  subject text not null,
  body text not null,                            -- placeholders: {{domain}} {{campaign_code}} {{iocs}} {{evidence_summary}} {{protocol}}
  active boolean not null default true,
  unique (kind, locale, version)
);
create table public.takedown_notices (
  id uuid primary key default gen_random_uuid(),
  protocol text not null unique default public.next_protocol(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  domain_id uuid references public.domains(id) on delete set null,
  kind public.notice_type not null,
  recipient_id uuid references public.recipients(id),
  status public.notice_status not null default 'draft',
  subject text not null,
  body text not null,
  evidence_path text,                            -- storage path of the evidence pack PDF
  created_by uuid not null references public.profiles(id),
  approved_by uuid references public.profiles(id),
  sent_at timestamptz,
  due_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (approved_by is null or approved_by <> created_by)   -- four-eyes
);
create trigger notices_updated before update on public.takedown_notices for each row execute function public.set_updated_at();
create index on public.takedown_notices (status, due_at);
create table public.notice_events (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references public.takedown_notices(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  kind text not null,                            -- created, submitted_for_review, approved, sent, reply, escalated, taken_down
  note text,
  created_at timestamptz not null default now()
);

-- Staff work
create table public.cases (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  status text not null default 'open' check (status in ('open','blocked','done')),
  priority public.severity not null default 'medium',
  assignee_id uuid references public.profiles(id),
  due_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create table public.advisories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title_sq text not null, title_en text not null,
  body_sq text not null, body_en text not null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  severity public.severity not null default 'medium',
  status text not null default 'draft' check (status in ('draft','in_review','published')),
  published_at timestamptz,
  created_by uuid not null references public.profiles(id),
  approved_by uuid references public.profiles(id)
);
create table public.blocklist_entries (
  id uuid primary key default gen_random_uuid(),
  type public.ioc_type not null,
  value text not null,
  reason text,
  campaign_id uuid references public.campaigns(id) on delete set null,
  expires_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (type, value)
);
create table public.alert_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  condition jsonb not null,                      -- {metric:'reports_per_hour', op:'>', value:20, institution:'e-albania'}
  channel text not null default 'in_app' check (channel in ('in_app','email')),
  active boolean not null default true,
  created_by uuid references public.profiles(id)
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, read_at, created_at desc);

create table public.feedback_labels (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.reports(id) on delete cascade,
  message_id uuid references public.messages(id) on delete cascade,
  analyst_id uuid not null references public.profiles(id),
  predicted public.msg_label,
  actual public.msg_label not null,
  created_at timestamptz not null default now()
);
create table public.model_versions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version text not null,
  metrics jsonb not null default '{}',           -- precision, recall, f1 on labels_mesazhet
  artifact_path text,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (name, version)
);
create table public.settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);
-- seed keys: thresholds {yellow:20, orange:40, red:60, darkred:80}, weights, auto_escalate_hours

-- Business
create table public.brand_assets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('domain','brand_name','sms_sender','phone','social','logo_hash')),
  value text not null,
  verified_at timestamptz,
  unique (org_id, kind, value)
);
create table public.brand_alerts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  domain_id uuid references public.domains(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  severity public.severity not null default 'medium',
  title text not null,
  status text not null default 'new' check (status in ('new','acknowledged','escalated','resolved')),
  created_at timestamptz not null default now()
);
create table public.simulations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  template_key text not null,
  status text not null default 'draft' check (status in ('draft','running','finished')),
  sent int not null default 0, opened int not null default 0, clicked int not null default 0, reported int not null default 0,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  prefix text not null,
  key_hash text not null unique,                 -- sha256 of the full key, shown once at creation
  scopes text[] not null default '{scan}',
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  action text not null,                          -- e.g. notice.approve, report.status, role.change
  entity text not null,
  entity_id text,
  data jsonb not null default '{}',
  ip_hash text,
  created_at timestamptz not null default now()
);
create index on public.audit_log (entity, entity_id);
create index on public.audit_log (created_at desc);
```

### 0004_rls.sql: row level security

Rule of thumb: **anonymous and citizen traffic never touches these tables directly.** Public features run in Route Handlers with the secret key. RLS exists so that a leaked publishable key or a coding mistake cannot expose data.

```sql
-- Enable RLS everywhere
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- profiles: self read/update (not role), staff read all, admin writes roles
create policy profiles_self_read on public.profiles for select to authenticated using (id = (select auth.uid()) or public.is_staff());
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()) and platform_role = (select platform_role from public.profiles where id = (select auth.uid())));
create policy profiles_admin_all on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- organizations and members
create policy org_member_read on public.organizations for select to authenticated using (public.is_org_member(id) or public.is_staff());
create policy org_admin_write on public.organizations for update to authenticated using (public.org_role(id) in ('owner','admin')) with check (public.org_role(id) in ('owner','admin'));
create policy members_read on public.organization_members for select to authenticated using (public.is_org_member(org_id) or public.is_staff());
create policy members_manage on public.organization_members for all to authenticated
  using (public.org_role(org_id) in ('owner','admin')) with check (public.org_role(org_id) in ('owner','admin'));

-- Reference data: any signed-in user reads, leads write
do $$ declare t text; begin
  foreach t in array array['institutions','official_domains','official_channels','recipients','templates','model_versions'] loop
    execute format('create policy %I on public.%I for select to authenticated using (true)', t||'_read', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_lead()) with check (public.is_lead())', t||'_lead', t);
  end loop;
end $$;

-- Staff-only investigation data: read for all staff, write for analysts and above
do $$ declare t text; begin
  foreach t in array array['campaigns','domains','campaign_domains','certificates','messages','iocs','known_hashes','checks','reports','report_events','campaign_notes','extension_installs','extension_reports','cases','feedback_labels','blocklist_entries','alert_rules'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.is_staff())', t||'_staff_read', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())', t||'_staff_write', t);
  end loop;
end $$;

-- Citizens with an account see only reports they filed
create policy reports_owner_read on public.reports for select to authenticated using (reporter_id = (select auth.uid()));
-- Business members see reports filed by their org
create policy reports_org_read on public.reports for select to authenticated using (reporter_org_id is not null and public.is_org_member(reporter_org_id));
create policy reports_org_insert on public.reports for insert to authenticated with check (reporter_org_id is not null and public.org_role(reporter_org_id) in ('owner','admin','security'));

-- Takedown: staff read, analysts create drafts, only leads approve and send
create policy notices_staff_read on public.takedown_notices for select to authenticated using (public.is_staff());
create policy notices_analyst_insert on public.takedown_notices for insert to authenticated with check (public.is_staff() and status = 'draft' and created_by = (select auth.uid()));
create policy notices_analyst_update_draft on public.takedown_notices for update to authenticated using (public.is_staff() and status in ('draft','in_review') and created_by = (select auth.uid())) with check (status in ('draft','in_review'));
create policy notices_lead_all on public.takedown_notices for update to authenticated using (public.is_lead()) with check (public.is_lead());
create policy notice_events_staff on public.notice_events for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Advisories: public reads published via the public view; staff manage
create policy advisories_staff on public.advisories for all to authenticated using (public.is_staff()) with check (public.is_staff() and (status <> 'published' or public.is_lead()));

-- Settings: staff read, admin write
create policy settings_read on public.settings for select to authenticated using (public.is_staff());
create policy settings_admin on public.settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Notifications: owner only
create policy notifications_owner on public.notifications for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Business tables: org members by role
create policy brand_assets_read on public.brand_assets for select to authenticated using (public.is_org_member(org_id) or public.is_staff());
create policy brand_assets_write on public.brand_assets for all to authenticated using (public.org_role(org_id) in ('owner','admin','security')) with check (public.org_role(org_id) in ('owner','admin','security'));
create policy brand_alerts_read on public.brand_alerts for select to authenticated using (public.is_org_member(org_id) or public.is_staff());
create policy brand_alerts_update on public.brand_alerts for update to authenticated using (public.org_role(org_id) in ('owner','admin','security')) with check (public.org_role(org_id) in ('owner','admin','security'));
create policy simulations_org on public.simulations for all to authenticated using (public.org_role(org_id) in ('owner','admin','security','comms')) with check (public.org_role(org_id) in ('owner','admin','security','comms'));
create policy api_keys_org on public.api_keys for all to authenticated using (public.org_role(org_id) in ('owner','admin')) with check (public.org_role(org_id) in ('owner','admin'));

-- Audit: leads and admins read, nobody writes through the API (server uses the secret key)
create policy audit_read on public.audit_log for select to authenticated using (public.is_lead());

-- Public, sanitized threat feed (no reporter data, only confirmed or public campaigns)
create view public.public_threat_feed with (security_invoker = false) as
  select c.code, c.tactic, c.imitated_name, c.first_seen, c.last_seen, c.message_count, c.status,
         coalesce((select array_agg(d.domain) from public.campaign_domains cd join public.domains d on d.id = cd.domain_id where cd.campaign_id = c.id), '{}') as domains
  from public.campaigns c where c.is_public and c.status in ('confirmed','takedown_in_progress','resolved');
revoke all on public.public_threat_feed from anon, authenticated;
grant select on public.public_threat_feed to service_role;   -- exposed only through /api/v1/feed

-- Storage buckets (create in seed.sql): evidence (private), brand-assets (private), exports (private). No public buckets.
-- Realtime: alter publication supabase_realtime add table public.reports, public.notifications, public.takedown_notices, public.campaigns;
```

RLS notes for the agent: never set `with check` weaker than `using` on write policies; wrap `auth.uid()` as `(select auth.uid())` for performance; test each policy with `supabase test db` (pgTAP) using three fixture users (citizen, analyst, lead) plus one business member.

## 6. Detection engine (runs inside Next.js)

Everything lives in `src/server/detection/` as pure TypeScript functions with no network calls except the optional LLM explanation. It must run in a Route Handler on the Node runtime in under 300 ms for a URL or short text. Every function is unit-tested against the CSVs in `data/s04/`.

### 6.1 Module map

| File              | Responsibility                                                                                                                                                                                                                                                                                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `normalize.ts`    | Lower-case, NFKC, strip zero-width characters, decode punycode (`punycode.toUnicode`), extract URLs / phones / IBAN-like / emails from text, defang and refang helpers                                                                                                                                                                                           |
| `domain-score.ts` | Lookalike detection against `official_domains`: Levenshtein ≤ 2 (typosquat), confusable-character map for homoglyphs (`1`→`l`, `0`→`o`, `rn`→`m`, Cyrillic/Greek lookalikes), combosquat (official brand token + extra words such as `aplikim`, `verify`, `fines`, `gov`), punycode `xn--` flag, suspicious TLDs, subdomain tricks (`e-albania.al.evil.example`) |
| `whois-score.ts`  | Reads `domains` rows: age under 30 days, privacy on, registrar and hosting country pairs frequently seen in campaigns, certificate issued within 48 h of registration, SAN containing a brand token                                                                                                                                                              |
| `text-model.ts`   | TF-IDF + logistic regression exported to JSON (`models/message-clf-v1.json`, trained offline on `labels_mesazhet.csv`, ≈ a few hundred KB). Inference is a dot product in TS. Albanian and English tokenizers, character n-grams (3–5) to survive typos                                                                                                          |
| `rules.ts`        | Cheap deterministic signals: urgency words (sq/en), payment or refund lure, threat of fine or account closure, request for card / OTP / ID, QR or short-link, sender mismatch, official sender allowlist check                                                                                                                                                   |
| `sender.ts`       | Email: SPF/DKIM/DMARC results from headers when present, display-name vs address mismatch, reply-to mismatch, free-mail pretending to be institution; SMS: alphanumeric sender vs `official_channels`                                                                                                                                                            |
| `fusion.ts`       | Combines groups into the 0–100 score, applies floor and cap rules, returns reasons                                                                                                                                                                                                                                                                               |
| `campaigns.ts`    | Assigns a message to a campaign or proposes a new one (see 6.4)                                                                                                                                                                                                                                                                                                  |
| `explain.ts`      | Optional LLM call that rewrites reasons in friendly Albanian or English. The LLM never changes score or flag                                                                                                                                                                                                                                                     |
| `index.ts`        | `analyze(input): Promise<AnalysisResult>`                                                                                                                                                                                                                                                                                                                        |

### 6.2 Contracts

```ts
export type FlagLevel =
  | "green"
  | "yellow"
  | "orange"
  | "red"
  | "darkred"
  | "grey";

export interface AnalysisInput {
  kind: "url" | "text" | "phone" | "email_signals" | "qr";
  text?: string;
  urls?: string[];
  sender?: string;
  subject?: string;
  headers?: {
    spf?: "pass" | "fail" | "none";
    dkim?: "pass" | "fail" | "none";
    dmarc?: "pass" | "fail" | "none";
    replyTo?: string;
  };
  attachments?: { name: string; mime: string; size: number }[];
  channel: "sms" | "email" | "social" | "web" | "qr" | "call" | "other";
  locale: "sq" | "en";
}

export interface Reason {
  code: string;
  group: "links" | "content" | "sender" | "attachments" | "reputation";
  weight: number;
  text_sq: string;
  text_en: string;
  evidence?: string;
}

export interface AnalysisResult {
  score: number; // 0-100 integer
  flag: FlagLevel;
  groups: Record<Reason["group"], number>; // points awarded per group, capped at 30/25/25/10/10
  reasons: Reason[]; // sorted by weight desc, max 8 shown
  campaign?: {
    id?: string;
    code?: string;
    matchType: "known" | "similar" | "new_candidate";
    confidence: number;
  };
  matchedInstitution?: { id: string; name: string };
  iocs: { type: "domain" | "url" | "phone" | "email"; value: string }[];
  modelVersion: string;
}
```

### 6.3 Scoring rules (implement exactly, tune thresholds from `settings`)

| Group       | Max | Examples of points                                                                                                                                                                        |
| ----------- | --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Links       | 30  | lookalike domain 20 (typosquat 20, homoglyph 25, combosquat 18), punycode 8, domain age < 30 d 10, free/odd TLD 5, shortener 6, URL mismatch with visible text 8, QR to unknown domain 10 |
| Content     | 25  | classifier probability × 15, urgency 4, payment/refund lure 4, threat 4, asks for card/OTP/ID 8                                                                                           |
| Sender      | 25  | SPF/DKIM/DMARC fail 10 each (cap 20), display-name spoof 10, reply-to mismatch 6, unknown SMS sender claiming an institution 12                                                           |
| Attachments | 10  | executable or macro doc 10, archive with password 6, double extension 8                                                                                                                   |
| Reputation  | 10  | domain in `known_hashes` or `blocklist_entries` 10, previously confirmed in a campaign 10, reported by ≥ 3 independent users in 24 h 6                                                    |

- **Floor rule:** if the input matches a confirmed campaign IoC or blocklist entry, score = max(score, 80).
- **Cap rule:** if sender domain or SMS sender is an `official_channels` / `official_domains` match and SPF+DKIM+DMARC pass (or SMS sender matches exactly), score = min(score, 19).
- **Grey:** no text, unsupported attachment only, or analysis failed. Never show green for inputs that were not actually analysed.
- Flags default to 0–19 green, 20–39 yellow, 40–59 orange, 60–79 red, 80–100 dark red; read thresholds from `settings.thresholds`.
- Reasons must always be human-readable and bilingual; the UI shows the top 3 first, the rest behind a toggle.

Worked examples to turn into tests (from the dataset):

- `1ezhe-gov[.]al[.]example` (homoglyph of an official domain), registered a few days ago, SMS claiming a fine → links 25 + 10, content \~14, sender 12 → about 61–70 red, becomes dark red once the domain is blocklisted.
- `pogradec-fines-gov[.]al[.]example` and `xn--pogradc-dhg[.]al[.]test` from campaign F019 must resolve to the same campaign with matchType `known`.
- A real message from an official sender with passing auth must score ≤ 19 even if it contains the words fine or payment.

### 6.4 Campaign assignment

On every new confirmed or high-score item run `assignCampaign()`:

1. Exact IoC match (domain, url, phone, sender) → that campaign, confidence 1.0.
2. Same `body_hash`, or trigram similarity of masked body ≥ 0.8 against messages of the last 30 days (`pg_trgm` `similarity()` query) → that campaign, confidence = similarity.
3. Same imitated institution + same tactic + first-seen within 7 days of an existing campaign, with a lookalike domain registered under the same registrar or nameserver → `similar`, suggested to an analyst, not auto-merged.
4. Otherwise, if three or more unlinked items share a template fingerprint within 48 h → create a `new_candidate` campaign with code `C-2026-####` and status `monitoring`.

Analysts can merge, split and rename campaigns; every manual change is written to `report_events` and `audit_log`.

### 6.5 Training and evaluation (offline script)

`scripts/train-classifier.ts` reads `data/s04/labels_mesazhet.csv` and `A_mesazhet.csv`, splits 80/20 stratified by campaign (no campaign appears in both sets, to avoid leakage), trains TF-IDF + logistic regression, writes `models/message-clf-v1.json`, and inserts metrics (precision, recall, F1, confusion matrix) into `model_versions`. The admin page shows these numbers. If the metrics are not good enough at the deadline, the rules layer alone must still produce sensible scores: the classifier is one input, never the only one.

### 6.6 LLM explanation (optional)

`explain.ts` takes the already computed reasons and asks the configured provider (`LLM_PROVIDER` = `gemini` or `anthropic`) for a two-sentence plain-language summary in the user's locale. Timeout 4 s, cached by `input_hash + locale`, and on any failure fall back to the template text of the top reasons. Do not send raw citizen text if `consent_signal_report` is false: send only the reason codes and the defanged domains.

## 7. Public pages (no account needed)

All under `src/app/[locale]/(public)/`. Server Components by default, client islands only for interactive widgets. Every page has `generateMetadata`, OG image, and works with JavaScript disabled for reading. Panel IDs refer to Doc 1.

| Route                                              | Purpose                           | Key components and behaviour                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                                | Homepage (Doc 1, section 1)       | Hero with the **Check box** (tabs: Link, Message, Phone, QR image) that posts to `checkAction`; live counters (reports today, active campaigns, domains blocked) via cached query, revalidate 60 s; "How it works" in 3 steps; latest 3 campaigns from the public feed; three audience cards (Citizen, Business, Authorities); extension install CTA; trust strip with partner institution names; footer with privacy, API docs, contact |
| `/check`                                           | Full checker page                 | Same widget, large result: `ScoreRing`, `FlagBadge`, top reasons, "what to do now" checklist per flag, buttons **Report this** (creates a report, returns a tracking code) and **Share warning** (copy text). Result URL `/check/[id]` shows the stored result without the input. Rate limit 20 checks / 10 min / IP hash                                                                                                                |
| `/report`                                          | Guided report form                | 4-step wizard (what happened, channel, paste or upload screenshot, optional contact). Screenshot is processed client-side for text only when OCR is enabled; the image is not stored. Returns code like `SOC-2026/000123` and a private tracking token                                                                                                                                                                                   |
| `/track`                                           | Status lookup                     | Enter protocol + token, shows `StatusTimeline` (received, under review, confirmed, takedown requested, taken down)                                                                                                                                                                                                                                                                                                                       |
| `/threats`                                         | Public threat feed                | Filterable `CampaignCard` grid by institution, tactic, month; each card shows tactic, imitated brand, dates, defanged domains, status. Data from `public_threat_feed` through `/api/v1/feed`                                                                                                                                                                                                                                             |
| `/threats/[code]`                                  | Public campaign page              | Sanitized summary, timeline, example (masked) message, how to recognise it, what to do. No victim data                                                                                                                                                                                                                                                                                                                                   |
| `/learn`                                           | Awareness hub                     | 6 short guides (SMS fines, fake bank, fake jobs, parcel, e-Albania, QR codes), each with a real masked example and a 3-question quiz. MDX files in `content/learn/`                                                                                                                                                                                                                                                                      |
| `/learn/quiz`                                      | "Spot the scam" game              | 10 random items from labelled messages, user taps Scam or Legit, result card with explanation; score is local only                                                                                                                                                                                                                                                                                                                       |
| `/institutions`                                    | Institution directory             | Official domains, SMS senders and phone numbers per institution from `official_domains` / `official_channels`, so citizens can verify. Search + sector filter                                                                                                                                                                                                                                                                            |
| `/extension`                                       | Extension page                    | Install steps, what the extension reads and does not read, consent explanation, permissions list, screenshots                                                                                                                                                                                                                                                                                                                            |
| `/api-docs`                                        | Developer docs for the public API | Generated from the OpenAPI file in `src/app/api/v1/openapi.json`, with a try-it box for `/api/v1/scan`                                                                                                                                                                                                                                                                                                                                   |
| `/privacy`, `/terms`, `/accessibility`, `/contact` | Static legal pages                | Plain language, bilingual, last updated date                                                                                                                                                                                                                                                                                                                                                                                             |
| `/not-found`, `/error`                             | Branded error pages               | Shield illustration, link back to checker                                                                                                                                                                                                                                                                                                                                                                                                |

Common behaviours:

- **Language switcher** in the header, URL-based (`/sq/...`, `/en/...`), default `sq`.
- **Theme switcher** (dark default, light optional) with `next-themes`.
- **Result states** the checker must handle: loading skeleton, green, yellow, orange, red, dark red, grey (not analysed), rate-limited, and server error. Each has its own copy and illustration.
- **Accessibility:** colour is never the only signal (icon + label on every flag), focus rings visible, all form fields labelled, contrast checked in both themes.
- **Privacy:** the page shows a one-line note under the Check box: "We store a fingerprint of what you check, not the text."

## 8. Citizen dashboard (`/citizen`, optional account)

Citizens can use everything in section 7 without signing in. An account adds history, alerts and gamification. Sign-in: email magic link or Google. Layout: sidebar (desktop) / bottom tab bar (mobile), top bar with language, theme, notifications bell. Guard: `requireUser()` in `citizen/layout.tsx`. Panel IDs from Doc 1 in brackets.

| Route                   | Panel                    | What the page contains                                                                                                                              | Data and actions                                                                                                                                                            |
| ----------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/citizen`              | Home \[C1\]              | Safety score ring (0–100), next best action card, last 5 checks, active campaign warnings relevant to the user's saved institutions, streak counter | `profiles.safety_score`, `reports` by `reporter_id`, `public_threat_feed`                                                                                                   |
| `/citizen/checks`       | My checks \[C2\]         | Table of past checks (date, kind, flag, score). Row click opens result. Delete one or all                                                           | Checks are linked to the user only when "save my history" is on; stored as `checks` plus a `user_check_links` mapping table (`user_id`, `check_id`) added in migration 0005 |
| `/citizen/reports`      | My reports \[C3\]        | List with `StatusTimeline`, protocol, outcome note, "add detail" action                                                                             | `reports` where `reporter_id = auth.uid()`                                                                                                                                  |
| `/citizen/reports/[id]` | Report detail \[C3\]     | Full timeline, masked content, campaign link if public, takedown outcome                                                                            | RLS `reports_owner_read`                                                                                                                                                    |
| `/citizen/alerts`       | Alerts \[C4\]            | Warnings for institutions the user follows, with severity and "what to do"                                                                          | `notifications`, realtime channel                                                                                                                                           |
| `/citizen/watchlist`    | My watchlist \[C5\]      | Phone numbers, email, and names to monitor against new campaigns (stored hashed; match on hash only)                                                | `user_watch_items` (migration 0005)                                                                                                                                         |
| `/citizen/learn`        | Learning path \[C6\]     | Progress through guides and quizzes, badges (First report, 7-day streak, Quiz master)                                                               | `user_progress` (migration 0005)                                                                                                                                            |
| `/citizen/family`       | Family protection \[C7\] | Generate a printable one-page "scam safety card" for a relative; share link with the public guide matching their top threat                         | Client-side PDF via `@react-pdf/renderer`                                                                                                                                   |
| `/citizen/extension`    | Extension \[C8\]         | Install status, consent toggle for auto-submit, what was sent last (list of masked signal reports), revoke button                                   | `extension_installs`, `extension_reports`                                                                                                                                   |
| `/citizen/privacy`      | Privacy centre \[C9\]    | Export my data (JSON), delete my account and all links, consent log                                                                                 | Server Action `exportMyData`, `deleteMyAccount`                                                                                                                             |
| `/citizen/settings`     | Settings \[C10\]         | Name, language, notification preferences, linked sign-in methods                                                                                    | `profiles`                                                                                                                                                                  |

Migration `0005_citizen.sql` adds `user_check_links`, `user_watch_items`, `user_progress`, `user_badges` with owner-only RLS (`user_id = (select auth.uid())`).

Behaviours to implement:

- **Safety score** = weighted sum: checks made (cap 20), reports filed (cap 30), quizzes passed (cap 30), extension installed with consent (10), profile complete (10). Recomputed in a Server Action after each event, never trusted from the client.
- **Empty states** with an illustration and a single call to action on every list.
- **Mobile first:** all citizen pages are usable at 360 px width; tables turn into cards.
- **Realtime:** `notifications` subscribed through a small client component using the publishable key and the user's session; falls back to polling every 60 s.

## 9. Business dashboard (`/business`)

For companies and institutions that are being imitated. Guard: `requireOrgRole()` in `business/layout.tsx`; the active organization comes from a cookie-backed org switcher and is re-validated against `organization_members` on every request. Panel IDs from Doc 1 in brackets.

| Route                      | Panel                       | Contents                                                                                                                                                                                                           | Data and actions                                                                                        | Roles                  |
| -------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ---------------------- |
| `/business`                | Overview \[B1\]             | KPI tiles (open brand alerts, active campaigns imitating us, takedowns in progress, reports from our customers), 30-day trend chart, top 3 urgent alerts                                                           | `brand_alerts`, `campaigns` where `institution_id` = org institution                                    | all members            |
| `/business/onboarding`     | Brand setup \[B2\]          | Wizard: add domains, brand names, SMS sender IDs, phones, social handles; verify domain ownership by DNS TXT or a file at `/.well-known/mburoja.txt`                                                               | `brand_assets`, `verified_at` set by a Server Action that fetches only the member's own verified domain | owner, admin           |
| `/business/alerts`         | Brand alerts \[B3\]         | Inbox of new lookalike domains and campaigns; filters by severity and status; actions Acknowledge, Escalate to SOC, Resolve; each row opens detail with evidence                                                   | `brand_alerts`                                                                                          | owner, admin, security |
| `/business/campaigns`      | Campaigns against us \[B4\] | Cards of campaigns that imitate the brand with timeline, count, domains, status of takedowns, "what to tell customers" box                                                                                         | `campaigns`, `takedown_notices` (read-only summary)                                                     | all                    |
| `/business/domains`        | Lookalike domains \[B5\]    | Table of detected lookalikes (class, age, registrar, hosting, risk), allowlist button for our own registered variants, "request takedown" button that creates a report to SOC                                      | `domains` filtered by `imitates_institution_id`                                                         | owner, admin, security |
| `/business/reports`        | Customer reports \[B6\]     | Reports mentioning the brand, anonymised, with status; export CSV                                                                                                                                                  | `reports` joined to campaigns                                                                           | owner, admin, security |
| `/business/notices`        | Customer notices \[B7\]     | Draft a customer warning (SMS, email, banner text) from a campaign using a template, in sq and en, preview, copy. Sending is out of scope: copy only                                                               | `templates` locale variants                                                                             | owner, admin, comms    |
| `/business/training`       | Phishing simulations \[B8\] | Create an internal awareness campaign from a template, send to a pasted list of employee emails (simulated in the demo: no real mail unless `SIMULATE_EMAIL=false`), see sent / opened / clicked / reported funnel | `simulations`                                                                                           | owner, admin, security |
| `/business/api`            | API and keys \[B9\]         | Create, copy once, revoke API keys; usage chart; code snippets for `/api/v1/scan` in cURL, Node, PHP                                                                                                               | `api_keys` (store only hash)                                                                            | owner, admin           |
| `/business/team`           | Team \[B10\]                | Invite by email, assign role, remove                                                                                                                                                                               | `organization_members`, Supabase Auth invite via secret key in a Server Action                          | owner, admin           |
| `/business/reports/export` | Compliance export \[B11\]   | Monthly PDF/CSV report: incidents, takedown times, trend                                                                                                                                                           | Server Action generating a file in the `exports` bucket and a signed URL valid 10 min                   | owner, admin, finance  |
| `/business/settings`       | Settings \[B12\]            | Org profile, notification emails, data retention                                                                                                                                                                   | `organizations`                                                                                         | owner, admin           |

Behaviours:

- A new lookalike domain matching a verified `brand_assets` domain creates a `brand_alerts` row through the `detect-lookalikes` cron job (section 13) and a notification to `security` members.
- Business users never see other organizations' data and never see raw reporter details; only masked content and counts.
- The "Escalate to SOC" action creates a `reports` row with `source = 'business'` and `reporter_org_id` set, and links the alert.

## 10. Authorities dashboard (`/soc`)

The operations centre. Guard in `soc/layout.tsx`: `requireRole('soc_analyst')` (leads and admins pass). Dense dark layout, left rail with icons and badges, command palette (`⌘K`) for jumping to a report, campaign, domain or protocol number. Realtime updates on reports, takedowns and campaigns. Panel IDs from Doc 1 in brackets.

| Route                 | Panel                      | Contents                                                                                                                                                                                                                                                                       | Data and actions                                            | Min role       |
| --------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- | -------------- |
| `/soc`                | Command centre \[A1\]      | KPI row (new reports, high-risk queue, active campaigns, notices awaiting approval, median time-to-takedown), live map-free activity feed, 14-day volume chart by flag, "needs attention" list (overdue SLAs, spikes)                                                          | aggregates via SQL views, Realtime on `reports`             | analyst        |
| `/soc/inbox`          | Triage inbox \[A2\]        | `DataTable` of reports with score, flag, channel, institution, campaign, age. Filters, saved views, keyboard navigation (J/K, Enter, 1–5 to set status), bulk actions (assign, mark not scam, link to campaign)                                                                | `reports`, `report_events`; Server Actions with audit       | analyst        |
| `/soc/inbox/[id]`     | Report workspace \[A3\]    | Left: masked message with highlights of the signals; right: `ReasonList`, IoC table (defanged, copy buttons), similar items, campaign suggestion with confidence, notes thread, decision bar (Confirm scam, Not a scam, Need more info, Duplicate), "Create takedown" shortcut | `messages`, `iocs`, `assignCampaign()`                      | analyst        |
| `/soc/campaigns`      | Campaigns \[A4\]           | Grid/table with status, severity, institution, count, owner; create manual campaign; merge duplicates                                                                                                                                                                          | `campaigns`                                                 | analyst        |
| `/soc/campaigns/[id]` | Campaign workspace \[A5\]  | Header with status stepper; tabs **Overview** (stats, timeline chart, tactic), **Messages**, **Domains and IoCs**, **Takedowns**, **Notes**, **Advisory**; actions: assign owner, change status, publish to public feed (lead), export IoCs (CSV, STIX-lite JSON)              | `campaigns`, `campaign_domains`, `iocs`, `takedown_notices` | analyst        |
| `/soc/domains`        | Domain intelligence \[A6\] | Table of watched domains with class badge (typosquat/homoglyph/combosquat), whois age, registrar, hosting, CT cert time, risk; detail drawer with the rule that matched and the official domain it imitates; actions Mark threat, Dismiss, Allowlist, Create takedown          | `domains`, `certificates`                                   | analyst        |
| `/soc/takedowns`      | Takedown tracker \[A7\]    | Kanban or table by status (draft, in review, approved, sent, acknowledged, taken down, no response) with SLA countdown chips                                                                                                                                                   | `takedown_notices`                                          | analyst        |
| `/soc/takedowns/[id]` | Notice editor \[A8\]       | Notice preview in sq/en, editable subject and body with placeholders resolved, evidence pack link, recipient picker, timeline of events, buttons Submit for review (analyst), Approve and Send (lead, different person than creator)                                           | section 11                                                  | analyst / lead |
| `/soc/threat-map`     | Pattern explorer \[A9\]    | Charts: reports by institution, tactic share, registrar and hosting concentration, time heatmap (weekday × hour), channel mix                                                                                                                                                  | SQL views, `recharts`                                       | analyst        |
| `/soc/search`         | Global search \[A10\]      | Search across messages (trigram), domains, IoCs, protocols; results grouped by type                                                                                                                                                                                            | `pg_trgm` queries                                           | analyst        |
| `/soc/advisories`     | Advisories \[A11\]         | Draft public warnings bilingually from a campaign with a template; review and publish (lead)                                                                                                                                                                                   | `advisories`                                                | analyst / lead |
| `/soc/blocklist`      | Blocklist \[A12\]          | Manage blocked domains, URLs, phones with reason and expiry; export for operators and registrars as CSV                                                                                                                                                                        | `blocklist_entries`                                         | analyst        |
| `/soc/quality`        | Model quality \[A13\]      | Analyst feedback loop: false positives and false negatives queue, confusion matrix from `model_versions`, threshold simulator (change thresholds and see how many existing messages change flag)                                                                               | `feedback_labels`, `settings`                               | lead           |
| `/soc/alerts`         | Alert rules \[A14\]        | Create rules like "more than 20 reports in 1 h for one institution"; list of fired alerts                                                                                                                                                                                      | `alert_rules`, evaluated by the `evaluate-alerts` cron      | lead           |
| `/soc/admin`          | Admin \[A15\]              | Users and roles, institutions and official domains/channels, templates, recipients, settings (thresholds, weights, SLA hours), audit log viewer with filters, model versions                                                                                                   | `profiles`, reference tables, `audit_log`                   | lead / admin   |

Cross-cutting behaviours:

- **Audit:** every status change, role change, approval and send writes `audit_log` through `src/server/audit.ts`.
- **Optimistic UI** on triage actions with rollback on error and a toast (`sonner`).
- **Keyboard shortcuts** list in a `?` dialog.
- **Realtime:** one client provider subscribes to `reports` inserts and `takedown_notices` updates, shows a toast and increments the inbox badge. Fallback: refetch on window focus.
- **Export:** every table has CSV export of the current filters, capped at 10,000 rows, generated server-side.
- **Empty database:** all pages must render sensibly with zero rows (the seed script is optional).

## 11. Takedown module and templates

Code in `src/server/takedown/`. Sending is **simulated** in the hackathon build: the notice is rendered, stored, and logged as sent, and an outbox page shows what would have gone out. Real sending is behind `SIMULATE_EMAIL=false` and uses the configured SMTP or Resend provider. Use only `.example` addresses in seed data.

### 11.1 Workflow

1. Analyst opens a confirmed campaign or domain and clicks **Create takedown**. The server picks the notice kinds needed: `registrar` (from `domains.registrar` matched to `recipients.match_pattern`), `hosting` (from `hosting_country` / provider), `akcesk` (national authority, for `.al` domains or when the lead decides).
2. `buildNotice()` fills the template with campaign code, domain, defanged IoCs, first-seen dates, evidence summary, and the protocol number. Status `draft`.
3. Analyst edits if needed and clicks **Submit for review** → `in_review`, a notification goes to leads.
4. A lead (not the creator, enforced by the `check` constraint and the Server Action) clicks **Approve and send** → `approved` then `sent`, `sent_at` and `due_at = sent_at + recipient.sla_hours` are set, an `evidence pack` PDF is generated into the `evidence` bucket, a `notice_events` row and `audit_log` row are written.
5. Replies are logged manually (`acknowledged`, `taken_down`, `rejected`). When every notice of a domain is `taken_down`, the domain becomes `taken_down`; when all domains of a campaign are, the campaign becomes `resolved`.
6. The `escalate-overdue` cron (every 15 min) finds `sent` notices past `due_at`, sets `no_response`, creates a task and notifies leads.

### 11.2 Notice types

| Kind        | Recipient                      | SLA                               | Content focus                                                                                                 |
| ----------- | ------------------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `registrar` | Registrar abuse contact        | 24 h                              | Domain is a lookalike used for phishing, request suspension, include whois facts and evidence                 |
| `hosting`   | Hosting provider abuse contact | 12 h for dark red, 24 h otherwise | Hosted content impersonates a state or bank service, request removal, include URL list                        |
| `akcesk`    | National cyber authority       | 24 h                              | Incident summary, affected institution, number of reports, request for coordination and blocking at ISP level |

### 11.3 Template format

Templates are rows in `templates` (kind, locale, version). The repository ships `.md` sources in `src/server/takedown/templates/{kind}.{locale}.md` and `supabase/seed.sql` inserts them. Placeholders: `{{protocol}}`, `{{campaign_code}}`, `{{domain}}`, `{{imitated_institution}}`, `{{first_seen}}`, `{{report_count}}`, `{{iocs}}`, `{{evidence_summary}}`, `{{analyst_name}}`, `{{org_name}}`. Base the structure on `njoftim_bllokimi_shabllon.md` and the filled example in `njoftim_bllokimi_shembull.md` from the dataset: copy their sections and tone, do not invent legal citations. Each template exists in Albanian and English. Rendering uses a small `render(template, vars)` function that throws if a placeholder is missing, so a notice can never go out with `{{...}}` left in it.

### 11.4 Evidence pack

A PDF (`@react-pdf/renderer`) with: cover (protocol, campaign, date), campaign summary, masked sample messages (max 3), defanged IoC table, whois and certificate facts, timeline, analyst and approver names. No citizen contact data. Stored at `evidence/{notice_id}.pdf`, downloaded through a signed URL valid for 5 minutes.

### 11.5 Server Actions (all in `src/app/[locale]/soc/takedowns/actions.ts`)

| Action              | Input                                | Checks                                              | Effect                                                        |
| ------------------- | ------------------------------------ | --------------------------------------------------- | ------------------------------------------------------------- |
| `createTakedown`    | `campaignId`, `domainId?`, `kinds[]` | analyst, campaign confirmed                         | Inserts drafts, event `created`                               |
| `updateNoticeDraft` | `id`, `subject`, `body`              | creator, status draft or in_review                  | Updates text                                                  |
| `submitForReview`   | `id`                                 | creator                                             | `in_review`, notifies leads                                   |
| `approveAndSend`    | `id`                                 | lead, `approved_by <> created_by`, status in_review | Generates evidence PDF, simulates send, sets `sent`, `due_at` |
| `logReply`          | `id`, `outcome`, `note`              | analyst                                             | Updates status, may cascade to domain and campaign            |
| `rejectNotice`      | `id`, `reason`                       | lead                                                | Back to `draft` with note                                     |

All validate with zod, return `{ ok: true } | { ok: false, error }`, call `revalidatePath` for the tracker and the campaign page, and write `audit_log`.

## 12. Chrome extension (Manifest V3) and API contract

Folder `extension/` in the repo, built with Vite + TypeScript (`@crxjs/vite-plugin`), no framework needed beyond a tiny popup in React or vanilla. Targets Gmail and Outlook on the web, plus a generic "scan current page" action.

### 12.1 Files

| File                                             | Role                                                                                                                                                                                                                             |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `manifest.json`                                  | MV3, `permissions: ["storage","activeTab","scripting"]`, `host_permissions` only for `https://mail.google.com/*`, `https://outlook.live.com/*`, `https://outlook.office.com/*` and the platform API origin                       |
| `src/content/gmail.ts`, `src/content/outlook.ts` | Inject a **Scan** button next to an open email; extract only the opened message (subject, sender, visible text, link hrefs with visible text, attachment names and mime, authentication results if exposed) when the user clicks |
| `src/background.ts`                              | Service worker: calls the API, stores last result, handles badge colour                                                                                                                                                          |
| `src/popup/`                                     | Shows score ring, flag, top 3 reasons, buttons **Report** and **Open on platform**; settings for consent and auto-submit                                                                                                         |
| `src/lib/analyze-local.ts`                       | Optional fast local rules (urgency words, link mismatch) so the badge shows within 100 ms before the API answers                                                                                                                 |
| `src/lib/mask.ts`                                | Masks phone, IBAN-like numbers, ID numbers, emails and personal names before anything is sent; unit tested                                                                                                                       |

### 12.2 Behaviour

- **Scan only on click.** The extension never reads mail in the background.
- Result shown in an overlay card on the email: flag colour, score, reasons, "What to do".
- **Auto-submit** is off until the user gives a one-time consent in the popup. After consent, any scan with flag **orange, red or dark red** sends a _signal report_ automatically; **yellow** sends indicators only (domains, flags, no text); **green and grey** send nothing.
- The _signal report_ contains: masked subject, masked body excerpt (first 600 characters), defanged URLs, sender domain, header auth results, attachment names/mime, score, flag, reason codes, extension version, install hash. It never contains the full email, recipient addresses, or the user's identity unless they are signed in and opted in.
- Badge: coloured dot with the flag; popup always says when something was sent and offers **Undo / delete my report** within 10 minutes (calls `DELETE /api/v1/extension/reports/{id}` with the install token).
- Offline or API failure: show local result with a grey "not verified" label, queue nothing.
- Chrome Web Store is out of scope: the build produces `extension/dist` to load unpacked, plus a zip for the `/extension` page.

### 12.3 API contract used by the extension (and the public API)

Base: `${APP_URL}/api/v1`. JSON only, UTF-8. CORS allowed for the extension origin and for the Gmail/Outlook origins only on these routes. Errors use `{ error: { code, message } }`.

| Method and path                  | Auth                         | Request                                      | Response                                               |
| -------------------------------- | ---------------------------- | -------------------------------------------- | ------------------------------------------------------ |
| `POST /extension/register`       | none, rate limited           | `{ installHash, version }`                   | `{ installToken }` (random, stored hashed server-side) |
| `POST /scan`                     | install token or API key     | `AnalysisInput` (section 6.2)                | `AnalysisResult` plus `checkId`                        |
| `POST /extension/reports`        | install token + consent flag | `{ signals: SignalReport, consent: true }`   | `{ reportId, protocol, deleteUntil }`                  |
| `DELETE /extension/reports/{id}` | install token                | none                                         | `204` within 10 min of creation                        |
| `GET /feed`                      | none, cached 60 s            | `?institution&since`                         | list from `public_threat_feed`                         |
| `GET /institutions/verify`       | none                         | `?domain=` or `?sender=`                     | `{ official: boolean, institution? }`                  |
| `POST /reports`                  | none (web form)              | report payload + Turnstile or honeypot token | `{ protocol, trackingToken }`                          |
| `GET /reports/{protocol}`        | tracking token header        | none                                         | status timeline                                        |

Rate limits (in-memory plus table-backed, see `rate-limit.ts`): `/scan` 60 / hour / install or key; `/reports` 10 / hour / IP hash; `/extension/register` 5 / hour / IP hash. Validate every body with zod; reject bodies over 64 KB.

## 13. API routes, Server Actions, jobs and realtime

### 13.1 Rules for choosing

- **Server Action** for mutations triggered from our own UI (triage, takedown, settings, profile). Always: `'use server'`, zod parse, `requireRole`/`requireOrgRole`, audit, `revalidatePath`/`revalidateTag`, typed result.
- **Route Handler** (`src/app/api/v1/**/route.ts`) for anything called from outside the app (extension, public API, cron, webhooks) and for anonymous public features. Node runtime, `export const dynamic = 'force-dynamic'`.
- **Server Component** for reads. Fetch directly with the server Supabase client; wrap shared aggregates in `use cache` with `cacheLife('minutes')` and tag them (`cacheTag('kpis')`), invalidated by actions.
- **Never** call the database from client components with the secret key. Client components may use the publishable key only for Realtime and for reads that RLS allows.

### 13.2 Route Handlers

| Path                                                                          | Methods              | Notes                                                                                                                                                                    |
| ----------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/api/v1/scan`                                                                | POST                 | Section 12.3. Runs `analyze()`, stores a `checks` row (hash only), returns result                                                                                        |
| `/api/v1/reports`                                                             | POST                 | Anonymous report. Honeypot field + Cloudflare Turnstile optional. Creates `messages` (masked), `reports`, returns tracking token (random 32 bytes, only its hash stored) |
| `/api/v1/reports/[protocol]`                                                  | GET                  | Tracking token in header                                                                                                                                                 |
| `/api/v1/extension/register`, `/extension/reports`, `/extension/reports/[id]` | POST / POST / DELETE | Section 12.3                                                                                                                                                             |
| `/api/v1/feed`                                                                | GET                  | From `public_threat_feed`, `Cache-Control: s-maxage=60`                                                                                                                  |
| `/api/v1/institutions/verify`                                                 | GET                  | Looks up `official_domains` and `official_channels`                                                                                                                      |
| `/api/v1/stats/public`                                                        | GET                  | Counters for the homepage                                                                                                                                                |
| `/api/v1/export/iocs`                                                         | GET                  | Staff session or API key with scope `iocs`; CSV or STIX-lite JSON                                                                                                        |
| `/api/cron/[job]`                                                             | GET                  | Requires `Authorization: Bearer ${CRON_SECRET}`; jobs below                                                                                                              |

### 13.3 Scheduled jobs

Trigger with Supabase `pg_cron` + `pg_net` calling the cron route, or with Vercel/host cron if deployed there. For local demo, a `npm run cron:run <job>` script calls the same handlers.

| Job                 | Schedule     | What it does                                                                                                                                                               |
| ------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `detect-lookalikes` | every 10 min | Takes new rows from `certificates`/`domains`, runs `domain-score`, inserts or updates `domains`, creates `brand_alerts` for matching `brand_assets`, creates notifications |
| `cluster-campaigns` | every 15 min | Runs step 4 of `assignCampaign()` over unlinked recent messages, updates `campaigns.message_count`, `last_seen`                                                            |
| `escalate-overdue`  | every 15 min | Section 11.1 step 6                                                                                                                                                        |
| `evaluate-alerts`   | every 5 min  | Evaluates `alert_rules`, creates notifications                                                                                                                             |
| `refresh-kpis`      | every 5 min  | Revalidates `kpis` cache tag                                                                                                                                               |
| `purge-privacy`     | daily        | Deletes `checks` older than 90 days, unlinked `messages` of non-confirmed reports older than 180 days, expired `known_hashes`, expired exports                             |

### 13.4 Realtime

- Publication: `reports`, `notifications`, `takedown_notices`, `campaigns` (section 5).
- Client provider `RealtimeProvider` in `soc/layout.tsx` and `citizen/layout.tsx` subscribes after the session is read on the server and passed as props. RLS applies to Realtime, so analysts receive all, citizens only their own notifications.
- Events: new report → toast + inbox badge; notice status change → refresh tracker; notification insert → bell counter.

### 13.5 Server helpers (`src/server/`)

| File                  | Exports                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------ |
| `supabase/server.ts`  | `createClient()` (cookie-bound, publishable key), `createAdminClient()` (secret key, `import 'server-only'`) |
| `supabase/browser.ts` | `createBrowserClient()`                                                                                      |
| `supabase/proxy.ts`   | session refresh helper used by `src/proxy.ts`                                                                |
| `auth.ts`             | `getSessionUser()`, `requireUser()`, `requireRole(min)`, `requireOrgRole(orgId, roles[])`                    |
| `audit.ts`            | `audit({ actorId, action, entity, entityId, data })`                                                         |
| `rate-limit.ts`       | `limit(key, max, windowSec)` using a table or in-memory Map with TTL                                         |
| `hash.ts`             | `sha256()`, `hashInput(kind, value)`, `ipHash(headers)` with a daily salt                                    |
| `email.ts`            | `sendMail()` that logs to `outbox` table when `SIMULATE_EMAIL=true`                                          |
| `llm.ts`              | Provider-agnostic `explain()` with timeout and cache                                                         |
| `mask.ts`             | Same masking rules as the extension (shared package `packages/shared` or copied file with test)              |

## 14. Seeding from the dataset CSVs

Put the files from the hackathon zip in `data/s04/`. `scripts/seed.ts` (run with `npm run seed`, uses the secret key, idempotent via upserts on `external_id`, `code`, `domain`, `cert_id`) loads them in this order:

1. `institutions` + `official_domains` + `official_channels`: derive institutions from the distinct `institucioni_imituar` values in `A_fushatat.csv` (e-Albania, Bashkia, Banka, Posta Shqiptare, Policia Rrugore, ISSH, Energji Shembull, Drejtoria e Tatimeve) and add one official domain per institution using `.example` names.
2. `campaigns` from `A_fushatat.csv`: `fushata_id` → `code`, `taktika` → `tactic`, `institucioni_imituar` → `institution_id`, `fillimi/fundi` → `first_seen/last_seen`, `nr_mesazheve` → `message_count`. Set status by a simple rule (e.g. campaigns that ended → `resolved`, others `monitoring`) and mark 8 as `is_public` for the demo.
3. `domains` from `B_whois.csv` (`regjistruesi` → registrar, `data_regjistrimit` → registered_at, `mosha_dite` → age_days, `nameserver`, `vendi_hostimit` → hosting_country, `privacy`, `etiketa` → class) and link to campaigns by matching each campaign's `domenet` list (split on the dataset's separator, normalise to lower case) → `campaign_domains`.
4. `certificates` from `B_ct_log.csv` (`san` split into array, `domeni_i_imituar` → imitated_domain).
5. `messages` from `A_mesazhet.csv` + `labels_mesazhet.csv`: use `teksti_defanged` for storage (never the raw text), apply `mask.ts`, compute `body_hash`, map `etiketa` → label, `fushata_id` → campaign. Keep `mesazh_id` in `external_id`.
6. `iocs` from every campaign domain and every message URL (defanged value stored, refanged only server-side when needed for matching).
7. `known_hashes` for all phishing-labelled domains and URLs.
8. `templates` (6 files, sq + en) and `recipients` (3 per kind with `.example` abuse addresses).
9. Demo users via `supabase.auth.admin.createUser`: `citizen@demo.example`, `analyst@demo.example` (soc_analyst), `lead@demo.example` (soc_lead), `admin@demo.example`, `owner@demo-bank.example` (org owner of a demo bank organization linked to the Banka institution). Password from env `DEMO_PASSWORD`, never committed.
10. 30 sample `reports` spread over the last 14 days (mix of sources and flags) so the dashboards are not empty, 3 draft `takedown_notices`, 2 `advisories`.
11. Storage buckets `evidence`, `brand-assets`, `exports`, all private.
12. Run `scripts/train-classifier.ts` and insert the active `model_versions` row.

Validation after seeding (script prints a table and fails if wrong): row counts per table equal CSV row counts, every message has a valid campaign or is legitimate, no row in `messages.body_masked` matches the regexes for phone, IBAN, email, 10-digit ID. Dataset values are synthetic (`.example`, `.test`); never add real brands, numbers or people.

## 15. Security, privacy and testing

### 15.1 Security checklist (each item must be true before the demo)

- Authorization is enforced in three places: RLS, server guards in every Server Action and Route Handler, and layout guards. `proxy.ts` only refreshes the session and redirects; it is never the only check.
- Secret key only in `createAdminClient()` files that start with `import 'server-only'`. A CI grep fails the build if `SUPABASE_SECRET_KEY` or `sb_secret_` appears in `src/app/**/*.tsx` client files or in `NEXT_PUBLIC_*` variables.
- All inputs validated with zod; request body size limits; output always escaped (React does this) and no `dangerouslySetInnerHTML` except for sanitized MDX.
- **No server-side fetching of submitted URLs** (prevents SSRF and avoids touching malicious sites). Reputation comes only from stored data and the dataset. Domain ownership verification fetches only the verified member's own domain, with a 3 s timeout, no redirects to private IP ranges, and a response size cap.
- Security headers in `next.config.ts`: CSP (self + Supabase origin + font origin), `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `frame-ancestors 'none'`.
- Rate limiting on every public Route Handler (section 12.3), bot protection on `/api/v1/reports` (honeypot minimum).
- Cookies: Supabase SSR defaults, `httpOnly`, `secure`, `sameSite=lax`. Server Actions rely on Next's built-in origin check.
- Tracking tokens, install tokens and API keys are random 32 bytes, stored only as SHA-256 hashes, compared in constant time.
- Four-eyes on takedowns and publishing; role changes only by `platform_admin`; every sensitive action audited.
- Dependencies pinned; run `npm audit` before the demo; keep Next.js on the latest patched 16.x because of the 2026 proxy/middleware bypass fixes.

### 15.2 Privacy by design

- Citizens need no account. Anonymous checks store only a hash and the result.
- Reports store masked text only. Masking runs server-side on every input and again in `seed.ts`; regexes cover phone numbers (Albanian formats `+355`, `06x`), IBAN-like strings, 10-character national ID patterns, emails, card-like digit runs, and capitalised name pairs after salutations.
- Retention (section 13.3 `purge-privacy`): checks 90 days, unconfirmed report content 180 days, evidence packs kept while the campaign is open + 1 year.
- User rights: export and delete in `/citizen/privacy`; deleting an account removes links but keeps de-identified reports.
- Extension: consent text is shown before the first auto-submit and recorded in `extension_installs.consent_at`; users can see and delete what was sent.
- Public pages and feed show defanged domains and no personal data. Staff UI always shows IoCs defanged with an explicit **Reveal** button that is audited.
- A data protection note in `/privacy` states controller, purposes, retention and contact. Mark it as a draft for legal review.

### 15.3 Testing plan

| Layer         | Tool                         | What to cover                                                                                                                                                                                                                            |
| ------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit          | Vitest                       | `normalize`, `domain-score` (typosquat, homoglyph, combosquat, punycode cases from the dataset), `fusion` floor and cap rules, `mask`, `render(template)` missing placeholder throws, `assignCampaign` exact and fuzzy matches           |
| Model         | Vitest + script              | Classifier metrics on the held-out campaign split; the three worked examples in section 6.3 pass                                                                                                                                         |
| Database      | pgTAP via `supabase test db` | Each RLS policy with citizen, analyst, lead, business member and anonymous: allowed and denied cases; four-eyes constraint; `public_threat_feed` not readable by anon                                                                    |
| Integration   | Vitest + local Supabase      | Server Actions: triage, takedown lifecycle, extension report create and undo                                                                                                                                                             |
| End to end    | Playwright                   | 1) anonymous check shows red and creates a report; 2) analyst sees it in realtime, confirms, creates takedown, lead approves; 3) citizen tracks status; 4) business user sees only own org; 5) language switch; 6) mobile viewport smoke |
| Accessibility | axe via Playwright           | No serious violations on home, check result, inbox, campaign page in both themes                                                                                                                                                         |
| Performance   | Lighthouse CI                | Home LCP < 2.5 s, `/api/v1/scan` p95 < 300 ms on seeded data                                                                                                                                                                             |

### 15.4 Definition of done (applies to every phase)

`npm run lint`, `npm run typecheck`, `npm run test` and `npm run build` pass; new tables have RLS and a pgTAP test; every page has loading, empty and error states in sq and en; no `any`; no secrets in the repo; the phase's acceptance criteria in section 16 are demonstrated in the browser.

## 16. Build phases, prompts and acceptance criteria (three people)

Assumption: roughly 24 hours of working time, three people working in parallel after phase 0. Roles are suggestions: **P1 platform and data**, **P2 detection and extension**, **P3 UI and dashboards**. Each phase prompt is meant to be pasted into Claude Code with `docs/SPEC.md` and `CLAUDE.md` already in the repo. If time runs short, cut from the bottom of the "Cut list" first.

| Phase                     | Hours | Owner           | Goal                                               |
| ------------------------- | ----- | --------------- | -------------------------------------------------- |
| 0 Foundation              | 0–1.5 | all, then split | Repo, Supabase local, auth, design tokens, layouts |
| 1 Data and detection core | 1.5–5 | P1 + P2         | Schema, RLS, seed, `analyze()`                     |
| 2 Public experience       | 1.5–8 | P3              | Homepage, checker, report, track, threats          |
| 3 SOC core                | 5–12  | P1 + P3         | Inbox, report workspace, campaigns, domains        |
| 4 Takedown                | 10–14 | P1              | Notices, approval, evidence, tracker               |
| 5 Extension               | 8–14  | P2              | Gmail and Outlook scan, consent, signal report     |
| 6 Citizen and business    | 12–18 | P3 + P1         | Dashboards in the reduced scope                    |
| 7 Polish and demo         | 18–24 | all             | Tests, seed data, demo script, slides              |

### Phase 0: Foundation

```text
Read docs/SPEC.md sections 1-4 and CLAUDE.md. The Next.js project already exists in this repo and uses npm: do not re-scaffold it, do not run create-next-app, do not switch package manager.
First inspect it (package.json, next.config, tsconfig.json, whether src/ is used, Tailwind version, existing app/ files) and list any mismatch with section 2. Fix mismatches minimally (move app/ into src/ if needed, set the @/* alias, move to Tailwind v4 if needed). Remove the default create-next-app demo page content.
Then follow section 2 steps 2-5: run npx shadcn@latest init and add the listed components, npm install the runtime and dev packages, add the npm scripts, npx supabase init and start.
Implement: the OKLCH design tokens and fonts from section 3 in globals.css, ThemeProvider (dark default), next-intl with sq default and en, the three Supabase helpers and src/proxy.ts (session refresh only), src/server/auth.ts guards, and empty layouts for (public), citizen, business, soc with the navigation from sections 7-10 (pages can be placeholders with a title). Add the shared components ScoreRing, FlagBadge, KpiTile, EmptyState, DataTable skeleton. Do not build features yet.
Acceptance: npm run dev runs; /sq and /en render the shell; signing in with a seeded demo user reaches the right layout; /soc redirects a citizen; npm run lint, npm run typecheck and npm run build pass; package-lock.json is the only lockfile.
```

### Phase 1: Data and detection core

```text
Implement section 5 as four migration files plus supabase/seed.sql for buckets and reference rows, then generate types. Write pgTAP tests for RLS in section 5 (citizen, analyst, lead, business member, anon). Then implement src/server/detection per section 6: normalize, domain-score, whois-score, rules, sender, fusion, campaigns, index, with unit tests using rows from data/s04. Write scripts/seed.ts per section 14 and scripts/train-classifier.ts per 6.5. Do not call any network service.
Acceptance: supabase db reset succeeds; npm run seed loads all CSVs with matching counts; npm run test passes the three worked examples; pgTAP passes; analyze() returns a result with reasons in under 300 ms.
```

### Phase 2: Public experience

```text
Build every route in section 7 using the design system in section 3. First the homepage and the Check box wired to POST /api/v1/scan (Route Handler with zod, rate limit, hash-only storage). Then /check result page with all seven result states, /report wizard, /track, /threats and /threats/[code] reading from public_threat_feed through /api/v1/feed, /learn with 6 MDX guides and the quiz, /institutions, /extension, /api-docs, legal pages. Everything bilingual and keyboard accessible.
Acceptance: the F019 example link returns red/dark red with reasons in Albanian and English; reporting returns a protocol and tracking token and the report appears in the database masked; /threats shows seeded public campaigns; axe finds no serious issues on home and result pages.
```

### Phase 3: SOC core

```text
Build /soc routes A1-A6 and A10 from section 10. Inbox with filters, saved views, keyboard shortcuts and bulk actions through Server Actions with audit. Report workspace with ReasonList, IoC table, campaign suggestion, decision bar and notes. Campaigns list and workspace with tabs. Domain intelligence table and drawer. Realtime provider for new reports. Command palette search. Use optimistic updates and sonner toasts.
Acceptance: submit a report from /report and see it appear in /soc/inbox without refresh; confirming it links it to a campaign and updates counts; every action creates an audit_log row; an analyst cannot publish a campaign to the public feed but a lead can.
```

### Phase 4: Takedown

```text
Implement section 11: templates from the dataset's shabllon and shembull files in sq and en, buildNotice and render with missing-placeholder errors, the six Server Actions, evidence pack PDF, tracker and editor pages (A7, A8), simulated outbox, escalate-overdue cron route.
Acceptance: create takedown from campaign F019 → three drafts in the right languages; creator cannot approve their own notice (UI and database); lead approves and the notice becomes sent with due_at and an evidence PDF; overdue notices become no_response through npm run cron:run escalate-overdue.
```

### Phase 5: Chrome extension

```text
Build extension/ per section 12 with Vite and @crxjs/vite-plugin: content scripts for Gmail and Outlook web that add a Scan button for the opened message, background worker calling POST /api/v1/scan with the install token, popup with result, consent and auto-submit toggle, mask.ts with tests, signal report submission and the 10-minute undo. Add the matching API routes and the /extension page assets.
Acceptance: load unpacked in Chrome; open a seeded phishing-style email in a test Gmail account; scan shows a red card with reasons; with consent on, a report appears in /soc/inbox with source extension and masked content; with consent off nothing is sent; undo removes the report.
```

### Phase 6: Citizen and business dashboards (reduced scope)

```text
Build sections 8 and 9 in this order, stopping when time is out: C1 home, C2 checks, C3 reports, C8 extension, C9 privacy; B1 overview, B2 brand setup, B3 alerts, B4 campaigns, B5 domains, B9 API keys, B10 team. Implement migration 0005 for citizen tables with owner-only RLS. Implement the detect-lookalikes and evaluate-alerts cron routes so brand alerts appear for the demo bank organization.
Acceptance: demo citizen sees only their own reports; demo bank owner sees alerts and campaigns for the Banka institution only and cannot read another organization's rows (pgTAP proves it); creating an API key shows it once and the key works against /api/v1/scan.
```

### Phase 7: Polish and demo

```text
Run the full testing plan in 15.3. Fix accessibility, empty/error states and mobile layouts. Add the pattern explorer (A9) and advisories (A11) if time remains. Create docs/DEMO.md with a 5-minute script: (1) citizen checks the F019 parking-fine link, (2) reports it, (3) analyst sees it live, confirms, campaign page shows 200 related messages and domains, (4) takedown created and approved by the lead, (5) bank owner sees the imitation alert, (6) extension flags a bank-verification email. Record a fallback video.
Acceptance: the demo script runs end to end on a clean database after supabase db reset and npm run seed in under 5 minutes.
```

### Cut list (drop from the bottom first)

1. Business simulations (B8), compliance export (B11), family card (C7)
2. Pattern explorer (A9), alert rules UI (A14), model quality page (A13)
3. Learning quiz game and badges
4. Citizen watchlist (C5) and learning path (C6)
5. LLM explanations (rules text is enough)
6. Outlook support in the extension (keep Gmail)

**Never cut:** the Check box, report flow, SOC inbox and report workspace, campaign page, takedown with approval, the extension scan, RLS, masking.

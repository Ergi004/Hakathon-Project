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
2. Browser code uses only the Supabase publishable key. The secret key is read only in server-only modules (`import 'server-only'`) and never prefixed with NEXT_PUBLIC_.
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

It type-checks, lints, runs locally (`npm run dev`) against the hosted Supabase project, works in Albanian and English, works on a 375 px wide screen, respects RLS (test with a different role), and the page or feature matches the spec section named in the task.

# Repo layout note

The Next.js project root is `client/` (this folder). All spec paths (`supabase/`, `messages/`, `src/`, `extension/`, `scripts/`, `data/s04/`, `models/`) are relative to `client/`. The spec lives at `client/docs/SPEC.md`.

# No Docker

Docker is not used in this project. Supabase is a hosted project (no `supabase start`, no local stack). Link it once with `npm run db:link`; every Supabase CLI command targets it with `--remote` (`db:push`, `db:test`, `db:types`). This overrides the Docker / local-Supabase steps in docs/SPEC.md sections 2, 15.3 and 16. `npm run db:reset` wipes the hosted database: run it only on a development project and only when asked.

# Mburoja

Anti-fraud platform (Next.js + Supabase). The app lives in `client/`.

## Local development

```bash
cd client
cp .env.example .env.local
npm install
npm run dev
```

## Deploy to Cloudflare Workers

Uses [@opennextjs/cloudflare](https://opennext.js.org/cloudflare).

```bash
cd client
npx wrangler login
npm run deploy
```

Set Supabase and other secrets in the Worker **Settings → Variables and Secrets**, and the same `NEXT_PUBLIC_*` values as **Build variables** if you use Workers Builds.

- Preview in the Workers runtime locally: `npm run preview`
- Deploy: `npm run deploy` (add `-- --keep-vars` after the first deploy so dashboard secrets are kept)

Workers Builds: root directory `client`, build `npx @opennextjs/cloudflare build`, deploy `npx @opennextjs/cloudflare deploy`.

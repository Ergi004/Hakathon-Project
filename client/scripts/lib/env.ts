import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing ${name}. Copy .env.example to .env.local and fill in the keys from your Supabase project (Dashboard → Project Settings → API Keys).`);
    process.exit(1);
  }
  return v;
}

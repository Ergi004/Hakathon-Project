import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against a running app (npm run dev) and the hosted Supabase project.
 * Credentials come from the environment, never from the repo:
 *   E2E_ANALYST_EMAIL / E2E_ANALYST_PASSWORD   a soc_analyst account
 *   E2E_CITIZEN_EMAIL / E2E_CITIZEN_PASSWORD   a citizen account
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  use: { baseURL: process.env.APP_URL ?? "http://localhost:3000", locale: "en-US", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});

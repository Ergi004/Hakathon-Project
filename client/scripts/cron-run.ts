/** Local demo: npm run cron:run <job> calls the same cron route handlers (SPEC 13.3). */
import "./lib/env";
import { requireEnv } from "./lib/env";

const JOBS = ["compute-geo-hotspots", "rebuild-region-stats", "poll-deep-scans", "escalate-overdue", "evaluate-alerts", "detect-lookalikes", "cluster-campaigns", "refresh-kpis", "purge-privacy", "process-scans", "poll-landing"];
const job = process.argv[2];
if (!job || !JOBS.includes(job)) {
  console.error(`Usage: npm run cron:run <${JOBS.join("|")}>`);
  process.exit(1);
}
const base = process.env.APP_URL ?? "http://localhost:3000";
async function main() {
  const res = await fetch(`${base}/api/cron/${job}`, { headers: { Authorization: `Bearer ${requireEnv("CRON_SECRET")}` } });
  console.log(res.status, JSON.stringify(await res.json(), null, 2));
  process.exit(res.ok ? 0 : 1);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });

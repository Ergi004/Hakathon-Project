import type { IocKind } from "./context";
import { iocKey } from "./context";
import { hostOf, refang } from "./normalize";

/** A signed-in reporter, or one IP. Repeats from the same person or address do not count again. */
export function reporterKey(reporterId: string | null | undefined, ipHash: string | null | undefined): string | null {
  if (reporterId) return `user:${reporterId}`;
  if (ipHash) return `ip:${ipHash}`;
  return null;
}

export interface ReportSighting {
  urls: string[];
  reporterId: string | null;
  ipHash: string | null;
}

/** Distinct people who reported each URL or domain. Unidentified repeats are ignored. */
export function countDistinctReporters(rows: ReportSighting[]): { kind: IocKind; value: string; count: number }[] {
  const sets = new Map<string, { kind: IocKind; value: string; people: Set<string> }>();
  for (const row of rows) {
    const person = reporterKey(row.reporterId, row.ipHash);
    if (!person) continue;
    for (const raw of row.urls) {
      const url = refang(raw);
      const host = hostOf(url);
      const targets: { kind: IocKind; value: string }[] = [];
      if (host) targets.push({ kind: "domain", value: host });
      if (url.includes("://")) targets.push({ kind: "url", value: url });
      for (const target of targets) {
        const key = iocKey(target.kind, target.value);
        const bucket = sets.get(key) ?? { kind: target.kind, value: target.value, people: new Set<string>() };
        bucket.people.add(person);
        sets.set(key, bucket);
      }
    }
  }
  return [...sets.values()].map((bucket) => ({ kind: bucket.kind, value: bucket.value, count: bucket.people.size }));
}

import { parseSender } from "@/server/detection/normalize";
import type { AuthResults, Finding } from "../../types";

export type HeaderMap = Map<string, string[]>;

/** Raw header block → lower-case key → values (in order, unfolded). */
export function parseHeaderBlock(raw: string): HeaderMap {
  const map: HeaderMap = new Map();
  const head = raw.split(/\r?\n\r?\n/, 1)[0] ?? "";
  const unfolded = head.replace(/\r?\n[ \t]+/g, " ");
  for (const line of unfolded.split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i <= 0) continue;
    const key = line.slice(0, i).trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(key)) continue;
    const list = map.get(key) ?? [];
    list.push(line.slice(i + 1).trim());
    map.set(key, list);
  }
  return map;
}

export function headerMapFrom(entries: { key: string; value: string }[]): HeaderMap {
  const map: HeaderMap = new Map();
  for (const h of entries) {
    const k = h.key.toLowerCase();
    map.set(k, [...(map.get(k) ?? []), h.value]);
  }
  return map;
}

const SPF = new Set(["pass", "fail", "softfail", "neutral", "none"]);

/**
 * Reads SPF/DKIM/DMARC from the receiving server's Authentication-Results
 * header (the topmost one). A DNS lookup cannot prove a message passed, so
 * without that header the result is "absent", not "pass".
 */
export function readAuthResults(headers: HeaderMap): AuthResults {
  const ar = headers.get("authentication-results")?.[0] ?? headers.get("arc-authentication-results")?.[0];
  if (!ar) return { spf: "none", dkim: "none", dmarc: "none", source: "absent" };
  const pick = (name: string) => ar.match(new RegExp(`\\b${name}=([a-z]+)`, "i"))?.[1]?.toLowerCase();
  const spfRaw = pick("spf");
  const spf = (spfRaw && SPF.has(spfRaw) ? spfRaw : spfRaw ? "fail" : "none") as AuthResults["spf"];
  const two = (v?: string): "pass" | "fail" | "none" => (!v || v === "none" ? "none" : v === "pass" ? "pass" : "fail");
  return { spf, dkim: two(pick("dkim")), dmarc: two(pick("dmarc")), source: "authentication-results" };
}

function domainOf(addr?: string | null): string | null {
  if (!addr) return null;
  const m = addr.match(/@([a-z0-9.-]+)/i);
  return m ? m[1].toLowerCase().replace(/\.$/, "") : null;
}

/** Organisational domain approximation: last two labels (good enough for mismatch hints, never for verdicts alone). */
function orgDomain(d: string | null): string | null {
  if (!d) return null;
  const parts = d.split(".");
  return parts.slice(-2).join(".");
}

export interface HeaderAnalysis {
  auth: AuthResults;
  sender?: string;
  replyTo?: string;
  returnPath?: string;
  receivedHops: number;
  findings: Finding[];
}

/** Sender / Reply-To / Return-Path alignment and authentication results (PDF §7.1). */
export function analyzeHeaders(
  headers: HeaderMap,
  overrides: { sender?: string; replyTo?: string; returnPath?: string } = {},
): HeaderAnalysis {
  const sender = overrides.sender ?? headers.get("from")?.[0];
  const replyTo = overrides.replyTo ?? headers.get("reply-to")?.[0];
  const returnPath = overrides.returnPath ?? headers.get("return-path")?.[0]?.replace(/^<|>$/g, "");
  const auth = readAuthResults(headers);
  const findings: Finding[] = [];

  const fromParts = sender ? parseSender(sender) : null;
  const fromDomain = fromParts?.domain ?? null;

  if (auth.spf === "fail" || auth.spf === "softfail") findings.push({ code: "spf_fail", detail: `SPF result: ${auth.spf}`, evidence: auth.spf, weight: 10 });
  if (auth.dkim === "fail") findings.push({ code: "dkim_fail", detail: "DKIM signature did not verify", weight: 10 });
  if (auth.dmarc === "fail") findings.push({ code: "dmarc_fail", detail: "DMARC alignment failed", weight: 15 });

  const rtDomain = domainOf(replyTo ? parseSender(replyTo).address : null);
  if (fromDomain && rtDomain && orgDomain(rtDomain) !== orgDomain(fromDomain)) {
    findings.push({ code: "reply_to_mismatch", detail: "Reply-To domain differs from the From domain", evidence: rtDomain, weight: 8 });
  }
  const rpDomain = domainOf(returnPath);
  if (fromDomain && rpDomain && orgDomain(rpDomain) !== orgDomain(fromDomain)) {
    findings.push({ code: "return_path_mismatch", detail: "Return-Path (envelope sender) domain differs from the From domain", evidence: rpDomain, weight: 4 });
  }
  // "Bank Support <x@bank.example>" display names that embed a different address.
  const displayAddr = fromParts?.display ? domainOf(fromParts.display) : null;
  if (displayAddr && fromDomain && orgDomain(displayAddr) !== orgDomain(fromDomain)) {
    findings.push({ code: "display_name_spoof", detail: "The display name contains an address on a different domain", evidence: displayAddr, weight: 10 });
  }
  const msgIdDomain = domainOf(headers.get("message-id")?.[0]);
  if (fromDomain && msgIdDomain && orgDomain(msgIdDomain) !== orgDomain(fromDomain) && auth.dmarc !== "pass") {
    findings.push({ code: "message_id_mismatch", detail: "Message-ID domain differs from the From domain", evidence: msgIdDomain, weight: 2 });
  }

  return { auth, sender, replyTo, returnPath, receivedHops: headers.get("received")?.length ?? 0, findings };
}

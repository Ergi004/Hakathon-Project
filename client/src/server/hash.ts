import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export type HashKind = "url" | "domain" | "text" | "phone";

/** Fingerprint stored instead of what a citizen checked (SPEC 7: "a fingerprint, not the text"). */
export function hashInput(kind: HashKind, value: string): string {
  const v = kind === "text" ? value.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase() : value.trim().toLowerCase();
  return sha256(`${kind}:${v}`);
}

/** Daily-salted IP hash for rate limiting without storing IPs. */
export function ipHash(headers: Headers, now = new Date()): string {
  const ip =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "0.0.0.0";
  const day = now.toISOString().slice(0, 10);
  return sha256(`${process.env.IP_HASH_SALT ?? "mburoja-dev"}:${day}:${ip}`);
}

/** Random 32-byte token (tracking, install, API keys). Store only sha256(token). */
export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Constant-time comparison of two hex digests. */
export function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

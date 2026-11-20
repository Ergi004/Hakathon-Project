import "server-only";

import { tryAdmin } from "./db";

export interface Mail {
  to: string;
  subject: string;
  body: string;
  kind?: string;
  entity?: string;
  entityId?: string;
}

/**
 * SIMULATE_EMAIL=true (the default) logs to the outbox table instead of sending
 * (SPEC 2, 11). Real sending would plug a provider in here; the demo never does.
 */
export async function sendMail(mail: Mail): Promise<{ simulated: boolean }> {
  const simulated = process.env.SIMULATE_EMAIL !== "false";
  const db = tryAdmin();
  await db?.from("outbox").insert({
    to_address: mail.to,
    subject: mail.subject,
    body: mail.body,
    kind: mail.kind ?? "generic",
    entity: mail.entity ?? null,
    entity_id: mail.entityId ?? null,
    simulated,
  });
  if (!simulated) {
    // Real delivery intentionally not wired for the pilot: synthetic recipients only.
    console.warn("SIMULATE_EMAIL=false but no provider is configured; message logged only.");
  }
  return { simulated };
}

import "server-only";

import { tryAdmin } from "./db";

/**
 * TEMPORARY: lets users with an unverified email sign in.
 * Enabled only with AUTH_SKIP_EMAIL_CONFIRMATION=true. Remove this module (and
 * its two call sites in the sign-up and sign-in actions) to restore the guard.
 */
export function skipEmailConfirmation(): boolean {
  return process.env.AUTH_SKIP_EMAIL_CONFIRMATION === "true";
}

/** Marks an existing, still-unconfirmed account as confirmed. */
export async function confirmUserByEmail(email: string): Promise<boolean> {
  const db = tryAdmin();
  if (!db) return false;
  const target = email.trim().toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return false;
    const user = data.users.find((u) => u.email?.toLowerCase() === target);
    if (user) {
      if (user.email_confirmed_at) return true;
      const res = await db.auth.admin.updateUserById(user.id, { email_confirm: true });
      return !res.error;
    }
    if (data.users.length < 1000) return false;
  }
  return false;
}

/** Creates the account already confirmed (no confirmation email is sent). */
export async function createConfirmedUser(email: string, password: string, metadata: Record<string, unknown>) {
  const db = tryAdmin();
  if (!db) return { error: { code: "unavailable" } as const };
  const { error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: metadata });
  return { error: error ? { code: error.code ?? "unexpected_failure" } : null };
}

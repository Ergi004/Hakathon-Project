import "server-only";

import { tryAdmin } from "./db";

/**
 * No email verification: accounts are created already confirmed and signed in
 * straight away. Needs the secret key (SUPABASE_SECRET_KEY); without it we fall
 * back to a normal sign-up, which only signs in if "Confirm email" is turned off
 * in the Supabase project.
 */
export function canSkipVerification(): boolean {
  return !!process.env.SUPABASE_SECRET_KEY && !!process.env.NEXT_PUBLIC_SUPABASE_URL;
}

/** Creates the account already confirmed. No email is sent. */
export async function createConfirmedUser(email: string, password: string, metadata: Record<string, unknown>) {
  const db = tryAdmin();
  if (!db) return { error: { code: "unavailable" } };
  const { error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: metadata });
  return { error: error ? { code: error.code ?? "unexpected_failure" } : null };
}

/** Confirms an account created earlier while verification was still required. */
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
      return !(await db.auth.admin.updateUserById(user.id, { email_confirm: true })).error;
    }
    if (data.users.length < 1000) return false;
  }
  return false;
}

/**
 * Creates (or resets) an authorities/SOC account with a random password, printed once.
 *
 *   npm run staff:create -- <email> [soc_analyst|soc_lead|platform_admin] ["Full name"]
 *
 * Uses the secret key; the account is created already confirmed (no email step).
 */
import { randomBytes } from "node:crypto";
import { scriptClient } from "./lib/supabase";

const ROLES = ["soc_analyst", "soc_lead", "platform_admin"] as const;
type Role = (typeof ROLES)[number];

async function main() {
  const [email, roleArg = "soc_lead", name = "SOC Lead (demo)"] = process.argv.slice(2);
  const role = roleArg as Role;
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !ROLES.includes(role)) {
    console.error(`Usage: npm run staff:create -- <email> [${ROLES.join("|")}] ["Full name"]`);
    process.exit(1);
  }
  const db = scriptClient();
  const password = `${randomBytes(12).toString("base64url")}-A7`;

  // Find an existing user with this email (paged admin listing).
  let userId: string | null = null;
  for (let page = 1; page <= 20 && !userId; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    userId = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id ?? null;
    if (data.users.length < 200) break;
  }
  if (userId) {
    const { error } = await db.auth.admin.updateUserById(userId, { password, email_confirm: true, user_metadata: { full_name: name } });
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } });
    if (error || !data.user) throw new Error(error?.message ?? "createUser failed");
    userId = data.user.id;
  }

  // The profile row is created by the auth trigger; wait briefly, then set the role.
  for (let i = 0; i < 10; i++) {
    const { data } = await db.from("profiles").select("id").eq("id", userId).maybeSingle();
    if (data) break;
    await new Promise((r) => setTimeout(r, 300));
  }
  const { error: upErr } = await db.from("profiles").upsert({ id: userId, full_name: name, platform_role: role }, { onConflict: "id" });
  if (upErr) throw new Error(upErr.message);
  await db.from("audit_log").insert({ actor_id: null, action: "staff.create_script", entity: "profile", entity_id: userId, data: { role } });

  console.log(`\n✓ ${role} account ready\n  email:    ${email}\n  password: ${password}\n  sign in:  ${process.env.APP_URL ?? "http://localhost:3000"}/en/login\n\nThe password is shown only now. Run the command again to reset it.`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });

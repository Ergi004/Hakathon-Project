import { z } from "zod";

/** Locale-prefixed in-app path only, e.g. /sq/soc/inbox. Anything else is dropped. */
export const safeNextPath = z
  .string()
  .regex(/^\/(sq|en)(\/[A-Za-z0-9\-_/]*)?$/)
  .optional()
  .catch(undefined);

export const signInSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(6).max(128),
  next: safeNextPath,
});

export type SignInInput = z.infer<typeof signInSchema>;

export const ACCOUNT_TYPES = ["citizen", "business"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const orgNameSchema = z.string().trim().min(2).max(120);

/**
 * Sign-up for citizens and businesses (SPEC 4). Staff cannot self-register:
 * there is no staff option, and platform_role always starts as "user".
 */
export const signUpSchema = z
  .object({
    accountType: z.enum(ACCOUNT_TYPES),
    fullName: z.string().trim().max(120).optional(),
    email: z.email().max(254),
    // bcrypt only uses the first 72 bytes
    password: z.string().min(8).max(72),
    confirmPassword: z.string(),
    orgName: z.string().trim().max(120).optional(),
    acceptTerms: z.literal(true),
  })
  .superRefine((v, ctx) => {
    if (v.password !== v.confirmPassword) {
      ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "mismatch" });
    }
    if (v.accountType === "business") {
      if (!orgNameSchema.safeParse(v.orgName ?? "").success) {
        ctx.addIssue({ code: "custom", path: ["orgName"], message: "required" });
      }
      if (!v.fullName || v.fullName.length < 2) {
        ctx.addIssue({ code: "custom", path: ["fullName"], message: "required" });
      }
    }
  });

export type SignUpInput = z.input<typeof signUpSchema>;

/** What a business sign-up stores on the auth user until the email is confirmed. */
export const pendingOrgSchema = z.object({ name: orgNameSchema });

/** URL-safe slug with a short random suffix so two "Banka" orgs never collide. */
export function orgSlug(name: string, suffix: string): string {
  const base = name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `${base || "org"}-${suffix}`;
}

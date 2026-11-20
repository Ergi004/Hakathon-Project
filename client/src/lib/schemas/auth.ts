import { z } from "zod";

export const signInSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(6).max(128),
  /** Locale-prefixed in-app path only, e.g. /sq/soc/inbox. Anything else is ignored. */
  next: z
    .string()
    .regex(/^\/(sq|en)(\/[A-Za-z0-9\-_/]*)?$/)
    .optional()
    .catch(undefined),
});

export type SignInInput = z.infer<typeof signInSchema>;

"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient, SupabaseNotConfiguredError } from "./supabase/server";

export async function signOut(): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (error) {
    if (!(error instanceof SupabaseNotConfiguredError)) throw error;
  }
  redirect({ href: "/", locale: await getLocale() });
}

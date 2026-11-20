/**
 * Public Supabase settings. Both values are safe for the browser
 * (the publishable key only grants what RLS allows).
 * Returns null when Supabase is not configured, so the public site still renders.
 */
export function getPublicSupabaseEnv(): { url: string; publishableKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

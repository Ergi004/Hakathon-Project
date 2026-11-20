"use client";

import { useTranslations } from "next-intl";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { createBrowserClient } from "@/server/supabase/client";

const BadgeContext = createContext<{ inbox: number; reset: () => void }>({ inbox: 0, reset: () => {} });
export const useSocBadge = () => useContext(BadgeContext);

/**
 * One subscription for the SOC (SPEC 10, 13.4): new reports → toast + inbox badge,
 * notice updates → refresh. RLS applies to Realtime. Fallback: refetch on focus.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("soc.inbox");
  const router = useRouter();
  const [inbox, setInbox] = useState(0);

  useEffect(() => {
    let supabase: ReturnType<typeof createBrowserClient> | null = null;
    try {
      supabase = createBrowserClient();
    } catch {
      supabase = null;
    }
    const onFocus = () => router.refresh();
    window.addEventListener("focus", onFocus);
    if (!supabase) return () => window.removeEventListener("focus", onFocus);

    const channel = supabase
      .channel("soc-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reports" }, (payload) => {
        const protocol = (payload.new as { protocol?: string }).protocol ?? "";
        setInbox((n) => n + 1);
        toast(t("newReport", { protocol }), { action: { label: "→", onClick: () => router.push(`/soc/inbox/${(payload.new as { id: string }).id}`) } });
        router.refresh();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "takedown_notices" }, () => router.refresh())
      .subscribe();
    return () => {
      window.removeEventListener("focus", onFocus);
      supabase?.removeChannel(channel);
    };
  }, [router, t]);

  return <BadgeContext.Provider value={{ inbox, reset: () => setInbox(0) }}>{children}</BadgeContext.Provider>;
}

"use client";

import { Bell, BellOff, Building2, Check, CheckCheck, ChevronRight, Eye, Search, ShieldAlert, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { markNotificationsRead, setFollow } from "@/app/[locale]/citizen/_actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link, useRouter } from "@/i18n/navigation";
import { fmtAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createBrowserClient } from "@/server/supabase/client";

type R = { ok: boolean; error?: string };
function useRun() {
  const tu = useTranslations("ui");
  const router = useRouter();
  const [pending, start] = useTransition();
  return {
    pending,
    run: (fn: () => Promise<R>) =>
      start(async () => {
        const r = await fn();
        if (r.ok) router.refresh();
        else toast.error(r.error === "forbidden" ? tu("errorForbidden") : tu("errorGeneric"));
      }),
  };
}

export interface Note { id: string; title: string; body: string | null; href: string | null; read_at: string | null; created_at: string }

function noteIcon(n: Note) {
  if (n.body === "watch_match" || n.href?.startsWith("/citizen/watchlist")) return { Icon: Eye, tone: "bg-flag-orange/15 text-flag-orange" };
  if (n.href?.startsWith("/threats")) return { Icon: ShieldAlert, tone: "bg-flag-red/15 text-flag-red" };
  return { Icon: Bell, tone: "bg-primary/15 text-primary" };
}

/** Notification inbox with All / Unread tabs. Live via Supabase Realtime, with a 60 s refresh fallback. */
export function NotificationInbox({ items }: { items: Note[] }) {
  const t = useTranslations("cit.alerts");
  const locale = useLocale();
  const router = useRouter();
  const { pending, run } = useRun();
  const [tab, setTab] = useState<"all" | "unread">("all");

  useEffect(() => {
    let client: ReturnType<typeof createBrowserClient> | null = null;
    try { client = createBrowserClient(); } catch { client = null; }
    const poll = setInterval(() => router.refresh(), 60_000);
    const ch = client
      ?.channel("citizen-notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (p) => { toast((p.new as { title: string }).title); router.refresh(); })
      .subscribe();
    return () => { clearInterval(poll); if (ch) client?.removeChannel(ch); };
  }, [router]);

  const unread = items.filter((n) => !n.read_at).length;
  const shown = tab === "unread" ? items.filter((n) => !n.read_at) : items;

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b border-border py-5">
        <CardTitle className="flex items-center gap-2 font-display text-lg">
          {t("inbox")}
          {unread > 0 && <Badge className="rounded-full">{unread}</Badge>}
        </CardTitle>
        <CardDescription className="inline-flex items-center gap-2" aria-live="polite">
          <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-flag-green" />
          {t("live")}
        </CardDescription>
        <CardAction>
          {unread > 0 && (
            <Button size="sm" variant="outline" className="rounded-full" disabled={pending} onClick={() => run(() => markNotificationsRead({}))}>
              <CheckCheck className="size-4" aria-hidden="true" />
              {t("markAll")}
            </Button>
          )}
        </CardAction>
        <Tabs value={tab} onValueChange={(v) => setTab(v as "all" | "unread")} className="col-span-full mt-3">
          <TabsList>
            <TabsTrigger value="all" className="px-3">{t("tabAll")} <span className="text-muted-foreground">{items.length}</span></TabsTrigger>
            <TabsTrigger value="unread" className="px-3">{t("tabUnread")} <span className="text-muted-foreground">{unread}</span></TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="p-0">
        {!shown.length ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-muted">
              {tab === "unread" ? <CheckCheck className="size-6 text-flag-green" aria-hidden="true" /> : <BellOff className="size-6 text-muted-foreground" aria-hidden="true" />}
            </span>
            <p className="font-medium">{tab === "unread" ? t("emptyUnread") : t("emptyTitle")}</p>
            {tab === "all" && <p className="max-w-sm text-sm text-muted-foreground">{t("empty")}</p>}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {shown.map((n) => {
              const { Icon, tone } = noteIcon(n);
              const isUnread = !n.read_at;
              return (
                <li key={n.id} className={cn("group relative flex items-start gap-4 px-5 py-4 transition-colors hover:bg-accent/40", isUnread && "bg-primary/[0.04]")}>
                  {isUnread && <span aria-hidden="true" className="absolute top-1/2 left-1.5 size-2 -translate-y-1/2 rounded-full bg-primary" />}
                  <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", tone)}>
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className={cn("leading-snug", isUnread ? "font-semibold" : "font-medium text-foreground/85")}>{n.title}</p>
                    {n.body && n.body !== "watch_match" && <p className="text-sm text-muted-foreground">{n.body}</p>}
                    <p className="text-xs text-muted-foreground">{fmtAgo(n.created_at, locale)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {isUnread && (
                      <Button size="icon" variant="ghost" className="size-8" disabled={pending} onClick={() => run(() => markNotificationsRead({ ids: [n.id] }))} aria-label={t("markRead")} title={t("markRead")}>
                        <Check className="size-4" aria-hidden="true" />
                      </Button>
                    )}
                    {n.href && (
                      <Button asChild size="sm" variant="ghost" className="h-8">
                        <Link href={n.href}>{t("open")}<ChevronRight className="size-4" aria-hidden="true" /></Link>
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Institutions the citizen follows: chips for the current ones, searchable switch list for the rest. */
export function FollowPanel({ institutions, followed }: { institutions: { id: string; name: string }[]; followed: string[] }) {
  const t = useTranslations("cit.alerts");
  const { pending, run } = useRun();
  const [q, setQ] = useState("");
  const on = useMemo(() => new Set(followed), [followed]);
  const followedList = institutions.filter((i) => on.has(i.id));
  const needle = q.trim().toLowerCase();
  const list = institutions.filter((i) => !needle || i.name.toLowerCase().includes(needle));
  const toggle = (id: string, follow: boolean) => run(() => setFollow({ institutionId: id, follow }));

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="font-display text-lg">{t("follow")}</CardTitle>
        <CardDescription>{t("followHint")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">{t("following", { count: followedList.length })}</p>
          {followedList.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {followedList.map((i) => (
                <li key={i.id}>
                  <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 py-1 pr-1 pl-3 text-sm">
                    {i.name}
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => toggle(i.id, false)}
                      className="grid size-5 place-items-center rounded-full text-muted-foreground hover:bg-primary/20 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      aria-label={t("unfollow", { name: i.name })}
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">{t("noFollows")}</p>
          )}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("followSearch")} aria-label={t("followSearch")} className="h-10 rounded-xl pl-9" />
        </div>

        <ul className="-mx-2 max-h-[26rem] space-y-0.5 overflow-y-auto px-2">
          {list.map((i) => {
            const isOn = on.has(i.id);
            return (
              <li key={i.id}>
                <label htmlFor={`f-${i.id}`} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-accent/50">
                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", isOn ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
                    <Building2 className="size-4" aria-hidden="true" />
                  </span>
                  <span className={cn("min-w-0 flex-1 truncate", isOn && "font-medium")}>{i.name}</span>
                  <Switch
                    id={`f-${i.id}`}
                    checked={isOn}
                    disabled={pending}
                    onCheckedChange={(v) => toggle(i.id, v)}
                    aria-label={isOn ? t("unfollow", { name: i.name }) : t("followAction", { name: i.name })}
                  />
                </label>
              </li>
            );
          })}
          {!list.length && <li className="px-2 py-4 text-center text-sm text-muted-foreground">{t("noMatch")}</li>}
        </ul>
      </CardContent>
    </Card>
  );
}

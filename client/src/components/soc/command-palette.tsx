"use client";

import { FileText, Flag, Globe, Hash, MessageSquare, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { paletteSearch } from "@/app/[locale]/soc/_actions/reports";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useRouter } from "@/i18n/navigation";
import { SOC_NAV } from "@/lib/nav";

type Results = NonNullable<Extract<Awaited<ReturnType<typeof paletteSearch>>, { ok: true }>["data"]>;

/** ⌘K: jump to a report, campaign, domain or protocol number (SPEC 10). */
export function CommandPalette() {
  const t = useTranslations("soc");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Results | null>(null);
  const [, start] = useTransition();
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (q.trim().length < 3) return;
    const id = setTimeout(() => start(async () => {
      const r = await paletteSearch({ q });
      setRes(r.ok ? r.data : null);
    }), 200);
    return () => clearTimeout(id);
  }, [q]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title={t("search.placeholder")} description={t("search.hint")}>
      <CommandInput placeholder={t("search.placeholder")} value={q} onValueChange={setQ} />
      <CommandList>
        <CommandEmpty>{q.length >= 3 ? t("search.none", { q }) : t("search.hint")}</CommandEmpty>
        {q.length < 3 && (
          <CommandGroup heading="Mburoja">
            {SOC_NAV.map((n) => (
              <CommandItem key={n.href} value={n.key} onSelect={() => go(n.href)}>
                <Search className="size-4" aria-hidden="true" /> {t(`nav.${n.key}`)}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {res && q.length >= 3 && (
          <>
            {res.reports.length > 0 && (
              <CommandGroup heading={t("search.reports")}>
                {res.reports.map((r) => (
                  <CommandItem key={r.id} value={`r-${r.protocol}`} onSelect={() => go(`/soc/inbox/${r.id}`)}>
                    <Hash className="size-4" aria-hidden="true" /> <span className="font-mono">{r.protocol}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {res.campaigns.length > 0 && (
              <CommandGroup heading={t("search.campaigns")}>
                {res.campaigns.map((c) => (
                  <CommandItem key={c.id} value={`c-${c.code}-${c.imitated_name ?? ""}`} onSelect={() => go(`/soc/campaigns/${c.id}`)}>
                    <Flag className="size-4" aria-hidden="true" /> <span className="font-mono">{c.code}</span> {c.imitated_name}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {res.domains.length > 0 && (
              <CommandGroup heading={t("search.domains")}>
                {res.domains.map((d) => (
                  <CommandItem key={d.id} value={`d-${d.domain}`} onSelect={() => go(`/soc/domains?q=${encodeURIComponent(d.domain)}`)}>
                    <Globe className="size-4" aria-hidden="true" /> <span className="font-mono">{d.domain.replace(/\./g, "[.]")}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {res.messages.length > 0 && (
              <CommandGroup heading={t("search.messages")}>
                {res.messages.slice(0, 6).map((m) => (
                  <CommandItem key={m.id} value={`m-${m.id}`} onSelect={() => go(`/soc/search?q=${encodeURIComponent(q)}`)}>
                    <MessageSquare className="size-4" aria-hidden="true" /> <span className="truncate">{m.body_masked.slice(0, 80)}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandGroup>
              <CommandItem value={`all-${q}`} onSelect={() => go(`/soc/search?q=${encodeURIComponent(q)}`)}>
                <FileText className="size-4" aria-hidden="true" /> {t("nav.search")}: “{q}”
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}

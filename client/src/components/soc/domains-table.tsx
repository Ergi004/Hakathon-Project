"use client";

import { Ban, Check, Gavel, ShieldAlert } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setDomainStatus } from "@/app/[locale]/soc/_actions/intel";
import { DefangedText } from "@/components/shared/defanged-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link, useRouter } from "@/i18n/navigation";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DomainRow } from "@/server/queries/soc";

function RiskBar({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-muted-foreground">—</span>;
  const color = value >= 80 ? "bg-flag-darkred" : value >= 60 ? "bg-flag-red" : value >= 40 ? "bg-flag-orange" : value >= 20 ? "bg-flag-yellow" : "bg-flag-green";
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-muted" aria-hidden="true"><span className={cn("block h-full", color)} style={{ width: `${value}%` }} /></span>
      <span className="text-xs tabular-nums">{value}</span>
    </span>
  );
}

/** A6 domain intelligence with a right-hand detail sheet (SPEC 3 DataTable pattern). */
export function DomainsTable({ rows, campaignsByDomain }: { rows: DomainRow[]; campaignsByDomain: Record<string, { id: string; code: string }[]> }) {
  const t = useTranslations("soc.domains");
  const tc = useTranslations("domainClass");
  const tu = useTranslations("ui");
  const tr = useTranslations("soc.report");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState<DomainRow | null>(null);
  const [pending, start] = useTransition();

  const set = (id: string, status: "threat" | "dismissed" | "allowlisted") =>
    start(async () => {
      const r = await setDomainStatus({ id, status });
      if (r.ok) {
        toast.success(t(`statuses.${status}`));
        setOpen((o) => (o ? { ...o, status } : o));
        router.refresh();
      } else toast.error(tu("errorGeneric"));
    });

  if (!rows.length) return <p className="rounded-xl bg-card p-14 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">{t("empty")}</p>;
  return (
    <>
      <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10 [&_th]:h-11 [&_th]:bg-muted/40">
        <Table>
          <TableHeader className="sticky top-0 bg-card/95">
            <TableRow>
              <TableHead>{t("domain")}</TableHead><TableHead>{t("class")}</TableHead><TableHead className="hidden lg:table-cell">{t("imitates")}</TableHead>
              <TableHead className="hidden md:table-cell">{t("age")}</TableHead><TableHead className="hidden xl:table-cell">{t("registrar")}</TableHead>
              <TableHead className="hidden xl:table-cell">{t("hosting")}</TableHead><TableHead className="hidden md:table-cell">{t("ct")}</TableHead>
              <TableHead>{t("risk")}</TableHead><TableHead>{t("status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((d) => (
              <TableRow key={d.id} tabIndex={0} className="cursor-pointer" onClick={() => setOpen(d)} onKeyDown={(e) => e.key === "Enter" && setOpen(d)}>
                <TableCell className="max-w-56 truncate font-mono text-xs">{d.domain.replace(/\./g, "[.]")}</TableCell>
                <TableCell><Badge variant="outline" className="whitespace-nowrap">{tc(d.class)}</Badge></TableCell>
                <TableCell className="hidden max-w-48 truncate font-mono text-xs lg:table-cell">{d.imitates_domain?.replace(/\./g, "[.]") ?? "—"}</TableCell>
                <TableCell className="hidden text-xs md:table-cell">{d.age_days !== null ? t("ageDays", { count: d.age_days }) : "—"}</TableCell>
                <TableCell className="hidden text-xs xl:table-cell">{d.registrar ?? "—"}</TableCell>
                <TableCell className="hidden text-xs xl:table-cell">{d.hosting_country ?? "—"}</TableCell>
                <TableCell className="hidden text-xs md:table-cell">{d.certificates?.[0]?.not_before ? fmtDate(d.certificates[0].not_before, locale) : "—"}</TableCell>
                <TableCell><RiskBar value={d.risk_score} /></TableCell>
                <TableCell><Badge variant={d.status === "threat" ? "destructive" : "secondary"}>{t(`statuses.${d.status as "threat"}`)}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {open && (
            <>
              <SheetHeader>
                <SheetTitle className="font-mono text-base">{open.domain.replace(/\./g, "[.]")}</SheetTitle>
                <SheetDescription>{tc(open.class)} · {t(`statuses.${open.status as "threat"}`)}</SheetDescription>
              </SheetHeader>
              <div className="space-y-5 px-4 pb-6 text-sm">
                <DefangedText value={open.domain} />
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
                  <dt className="text-muted-foreground">{t("rule")}</dt><dd className="font-mono text-xs">{open.rule ?? "—"}</dd>
                  <dt className="text-muted-foreground">{t("imitates")}</dt><dd className="font-mono text-xs">{open.imitates_domain?.replace(/\./g, "[.]") ?? "—"} {(open.institutions as { name: string } | null)?.name ? `(${(open.institutions as { name: string }).name})` : ""}</dd>
                  <dt className="text-muted-foreground">{t("age")}</dt><dd>{open.registered_at ? fmtDate(open.registered_at, locale) : "—"} {open.age_days !== null ? `· ${t("ageDays", { count: open.age_days })}` : ""}</dd>
                  <dt className="text-muted-foreground">{t("registrar")}</dt><dd>{open.registrar ?? "—"}</dd>
                  <dt className="text-muted-foreground">{t("nameserver")}</dt><dd className="font-mono text-xs">{open.nameserver ?? "—"}</dd>
                  <dt className="text-muted-foreground">{t("hosting")}</dt><dd>{open.hosting_country ?? "—"}</dd>
                  <dt className="text-muted-foreground">{t("privacy")}</dt><dd>{open.privacy === null ? "—" : open.privacy ? tu("yes") : tu("no")}</dd>
                  <dt className="text-muted-foreground">{t("risk")}</dt><dd><RiskBar value={open.risk_score} /></dd>
                </dl>
                {open.certificates?.length > 0 && (
                  <div className="space-y-2">
                    <p className="font-medium">{t("certs")}</p>
                    {open.certificates.map((c) => (
                      <div key={c.cert_id} className="rounded-lg border border-border p-2 text-xs">
                        <p className="font-mono">{c.cert_id}</p>
                        <p className="text-muted-foreground">{c.issuer ?? "—"} · {t("issued")} {fmtDate(c.not_before, locale)}</p>
                        <p className="font-mono text-muted-foreground">{t("san")}: {c.san.map((s) => s.replace(/\./g, "[.]")).join(", ")}</p>
                      </div>
                    ))}
                  </div>
                )}
                {(campaignsByDomain[open.id] ?? []).length > 0 && (
                  <div className="space-y-1">
                    <p className="font-medium">{t("campaigns")}</p>
                    <div className="flex flex-wrap gap-2">{campaignsByDomain[open.id].map((c) => <Badge key={c.id} variant="outline" className="font-mono"><Link href={`/soc/campaigns/${c.id}`}>{c.code}</Link></Badge>)}</div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                  <Button size="sm" variant="destructive" disabled={pending || open.status === "threat"} onClick={() => set(open.id, "threat")}><ShieldAlert className="size-4" aria-hidden="true" />{t("markThreat")}</Button>
                  <Button size="sm" variant="outline" disabled={pending || open.status === "dismissed"} onClick={() => set(open.id, "dismissed")}><Ban className="size-4" aria-hidden="true" />{t("dismiss")}</Button>
                  <Button size="sm" variant="outline" disabled={pending || open.status === "allowlisted"} onClick={() => set(open.id, "allowlisted")}><Check className="size-4" aria-hidden="true" />{t("allowlist")}</Button>
                  {(campaignsByDomain[open.id] ?? [])[0] && (
                    <Button size="sm" variant="secondary" asChild><Link href={`/soc/campaigns/${campaignsByDomain[open.id][0].id}?tab=takedowns`}><Gavel className="size-4" aria-hidden="true" />{tr("createTakedown")}</Link></Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

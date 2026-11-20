"use client";

import { Building2, Check, ChevronsUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { setActiveOrg } from "@/app/[locale]/business/_actions";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useRouter } from "@/i18n/navigation";

/** Brand switcher (SPEC 3 business layout): cookie-backed, re-validated on the server. */
export function OrgSwitcher({ current, orgs }: { current: { id: string; name: string }; orgs: { id: string; name: string }[] }) {
  const t = useTranslations("biz");
  const router = useRouter();
  const [pending, start] = useTransition();
  if (orgs.length <= 1) return <p className="inline-flex items-center gap-2 truncate text-sm font-medium"><Building2 className="size-4" aria-hidden="true" />{current.name}</p>;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="max-w-full gap-2" disabled={pending} aria-label={t("switchOrg")}>
          <Building2 className="size-4" aria-hidden="true" /><span className="truncate">{current.name}</span><ChevronsUpDown className="size-3.5 opacity-60" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>{t("switchOrg")}</DropdownMenuLabel>
        {orgs.map((o) => (
          <DropdownMenuItem key={o.id} onSelect={() => start(async () => { await setActiveOrg({ orgId: o.id }); router.refresh(); })}>
            {o.id === current.id ? <Check className="size-4" aria-hidden="true" /> : <span className="size-4" />}{o.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

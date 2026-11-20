"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { linkOrgInstitution } from "@/app/[locale]/admin/_actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from "@/i18n/navigation";

export function OrgLinkSelect({ orgId, current, institutions }: { orgId: string; current: string | null; institutions: { id: string; name: string }[] }) {
  const t = useTranslations("admin.orgs");
  const tu = useTranslations("ui");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Select value={current ?? "__none"} disabled={pending} onValueChange={(v) => start(async () => {
      const r = await linkOrgInstitution({ orgId, institutionId: v === "__none" ? null : v });
      if (r.ok) { toast.success(t("linked")); router.refresh(); } else toast.error(tu("errorForbidden"));
    })}>
      <SelectTrigger className="h-8 w-56" aria-label={t("institution")}><SelectValue /></SelectTrigger>
      <SelectContent><SelectItem value="__none">{t("none")}</SelectItem>{institutions.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
    </Select>
  );
}

"use client";

import { MapPin } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COUNTIES, municipalitiesOf, regionName } from "@/lib/geo/regions";

const NONE = "__none";

/**
 * Optional, coarse location: county then municipality. "Prefer not to say" is the default.
 * No GPS, no browser geolocation, no IP lookup, no address.
 */
export function RegionSelect({ county, municipality, onChange }: { county: string; municipality: string; onChange: (v: { county: string; municipality: string }) => void }) {
  const t = useTranslations("report.region");
  const locale = useLocale();
  const counties = [...COUNTIES].sort((a, b) => regionName(a.code, locale).localeCompare(regionName(b.code, locale), locale));
  return (
    <fieldset className="space-y-3 rounded-lg border border-border p-3">
      <legend className="inline-flex items-center gap-1.5 px-1 text-sm font-medium"><MapPin className="size-4" aria-hidden="true" />{t("legend")}</legend>
      <p className="text-xs text-muted-foreground">{t("hint")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="r-county">{t("county")}</Label>
          <Select value={county || NONE} onValueChange={(v) => onChange({ county: v === NONE ? "" : v, municipality: "" })}>
            <SelectTrigger id="r-county" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t("preferNot")}</SelectItem>
              {counties.map((c) => <SelectItem key={c.code} value={c.code}>{regionName(c.code, locale)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="r-muni">{t("municipality")}</Label>
          <Select value={municipality || NONE} disabled={!county} onValueChange={(v) => onChange({ county, municipality: v === NONE ? "" : v })}>
            <SelectTrigger id="r-muni" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{county ? t("pickMunicipality") : t("preferNot")}</SelectItem>
              {county && municipalitiesOf(county).map((m) => <SelectItem key={m.code} value={m.code}>{regionName(m.code, locale)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
    </fieldset>
  );
}

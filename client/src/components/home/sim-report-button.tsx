"use client";

import { Flag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { reportSimulation } from "@/server/actions/simulation";
import { Button } from "@/components/ui/button";

export function SimReportButton({ simId, token }: { simId: string; token: string }) {
  const t = useTranslations("sim");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  if (done) return <p className="text-sm text-flag-green" role="status">{t("reported")}</p>;
  return <Button disabled={pending} onClick={() => start(async () => { await reportSimulation({ simId, token }); setDone(true); })}><Flag className="size-4" aria-hidden="true" />{t("report")}</Button>;
}

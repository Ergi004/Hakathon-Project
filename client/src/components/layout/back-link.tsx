"use client";

import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/**
 * "Back" link for detail pages on dynamic routes ([id], [code]). Translating on
 * the client avoids reading the route params (runtime data) on the server just
 * for a label, which cacheComponents reports as a blocking prerender.
 */
export function BackLink({ href, namespace, label }: { href: string; namespace: string; label: string }) {
  const t = useTranslations(namespace as never);
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-2">
      <Link href={href}><ArrowLeft className="size-4" aria-hidden="true" />{t(label as never)}</Link>
    </Button>
  );
}

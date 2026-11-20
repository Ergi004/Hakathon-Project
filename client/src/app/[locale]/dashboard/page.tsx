import { Suspense } from "react";
import { ShellFallback } from "@/components/layout/shell-fallback";
import type { Locale } from "@/i18n/routing";
import { redirect } from "@/i18n/navigation";
import { homePathFor, requireUser } from "@/server/auth";

/** /dashboard has no UI of its own: send the user to their area (/soc, /business or /citizen). */
async function DashboardRedirect({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const ctx = await requireUser();
  return redirect({ href: await homePathFor(ctx), locale: locale as Locale });
}

export default function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <DashboardRedirect params={params} />
    </Suspense>
  );
}

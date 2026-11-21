import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { LoginForm } from "./login-form";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "auth.login" });
  return { title: t("title"), robots: { index: false } };
}

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("auth.login");

  return (
    <Card className="glass-card w-full max-w-md">
      <CardHeader>
        <CardTitle className="font-display text-2xl">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<Skeleton className="h-52 w-full" />}>
          <LoginForm />
        </Suspense>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          {t("noAccount")}{" "}
          <Link href="/register" className="font-medium text-foreground underline underline-offset-2">
            {t("createAccount")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

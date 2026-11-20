import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Locale } from "@/i18n/routing";
import { RegisterForm } from "./register-form";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: "auth.register" });
  return { title: t("title"), robots: { index: false } };
}

async function RegisterFormWithType({ searchParams }: { searchParams: Promise<{ type?: string | string[] }> }) {
  const { type } = await searchParams;
  return <RegisterForm initialType={type === "business" ? "business" : "citizen"} />;
}

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ type?: string | string[] }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("auth.register");

  return (
    <Card className="glass-card w-full max-w-lg">
      <CardHeader>
        <CardTitle className="font-display text-2xl">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<Skeleton className="h-[34rem] w-full" />}>
          <RegisterFormWithType searchParams={searchParams} />
        </Suspense>
      </CardContent>
    </Card>
  );
}

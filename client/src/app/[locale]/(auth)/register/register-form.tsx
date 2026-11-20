"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, MailCheck, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch, type FieldPath } from "react-hook-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Link } from "@/i18n/navigation";
import { signUpSchema, type AccountType, type SignUpInput } from "@/lib/schemas/auth";
import { cn } from "@/lib/utils";
import { signUp, type SignUpError } from "./actions";

const FIELD_ERROR: Record<FieldPath<SignUpInput>, "required" | "email" | "passwordShort" | "mismatch" | "terms"> = {
  accountType: "required",
  fullName: "required",
  email: "email",
  password: "passwordShort",
  confirmPassword: "mismatch",
  orgName: "required",
  acceptTerms: "terms",
};

export function RegisterForm({ initialType }: { initialType: AccountType }) {
  const t = useTranslations("auth.register");
  const tf = useTranslations("auth.fieldErrors");
  const te = useTranslations("auth.signUpErrors");
  const [serverError, setServerError] = useState<SignUpError | null>(null);
  const [sentTo, setSentTo] = useState<{ email: string; business: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      accountType: initialType,
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      orgName: "",
      acceptTerms: false as unknown as true,
    },
  });
  const accountType = useWatch({ control: form.control, name: "accountType" });
  const isBusiness = accountType === "business";

  const onSubmit = form.handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const result = await signUp(values);
      if (!result) return; // redirected
      if (result.ok) setSentTo({ email: values.email, business: values.accountType === "business" });
      else setServerError(result.error);
    });
  });

  if (sentTo) {
    return (
      <div className="space-y-4 text-center" role="status" aria-live="polite">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-primary/15 text-primary">
          <MailCheck className="size-6" aria-hidden="true" />
        </div>
        <h2 className="font-display text-xl font-bold">{t("checkEmailTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("checkEmailBody", { email: sentTo.email })}</p>
        {sentTo.business && <p className="text-sm text-muted-foreground">{t("checkEmailBusiness")}</p>}
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">{t("backToLogin")}</Link>
        </Button>
      </div>
    );
  }

  const err = (name: FieldPath<SignUpInput>) => tf(FIELD_ERROR[name]);

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {serverError && (
        <Alert variant="destructive" aria-live="polite">
          <AlertDescription>{te(serverError)}</AlertDescription>
        </Alert>
      )}

      <Controller
        name="accountType"
        control={form.control}
        render={({ field }) => (
          <FieldSet>
            <FieldLegend variant="label">{t("accountType")}</FieldLegend>
            <RadioGroup
              value={field.value}
              onValueChange={(v) => field.onChange(v as AccountType)}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            >
              {(["citizen", "business"] as const).map((type) => {
                const Icon = type === "citizen" ? UserRound : Building2;
                const selected = field.value === type;
                return (
                  <label
                    key={type}
                    htmlFor={`type-${type}`}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                      selected ? "border-primary bg-primary/10" : "border-border hover:bg-accent",
                    )}
                  >
                    <RadioGroupItem id={`type-${type}`} value={type} className="mt-0.5" />
                    <span className="space-y-0.5">
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        <Icon className="size-4" aria-hidden="true" />
                        {t(type)}
                      </span>
                      <span className="block text-xs text-muted-foreground">{t(`${type}Hint`)}</span>
                    </span>
                  </label>
                );
              })}
            </RadioGroup>
          </FieldSet>
        )}
      />

      <FieldGroup>
        {isBusiness && (
          <Controller
            name="orgName"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="orgName">{t("orgName")}</FieldLabel>
                <Input {...field} id="orgName" autoComplete="organization" aria-invalid={fieldState.invalid} />
                <FieldDescription>{t("orgHint")}</FieldDescription>
                {fieldState.invalid && <FieldError>{err("orgName")}</FieldError>}
              </Field>
            )}
          />
        )}
        <Controller
          name="fullName"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="fullName">{isBusiness ? t("fullName") : t("fullNameOptional")}</FieldLabel>
              <Input {...field} id="fullName" autoComplete="name" aria-invalid={fieldState.invalid} />
              {fieldState.invalid && <FieldError>{err("fullName")}</FieldError>}
            </Field>
          )}
        />
        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="email">{isBusiness ? t("workEmail") : t("email")}</FieldLabel>
              <Input {...field} id="email" type="email" inputMode="email" autoComplete="email" aria-invalid={fieldState.invalid} />
              {fieldState.invalid && <FieldError>{err("email")}</FieldError>}
            </Field>
          )}
        />
        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="password">{t("password")}</FieldLabel>
              <Input {...field} id="password" type="password" autoComplete="new-password" aria-invalid={fieldState.invalid} />
              <FieldDescription>{t("passwordHint")}</FieldDescription>
              {fieldState.invalid && <FieldError>{err("password")}</FieldError>}
            </Field>
          )}
        />
        <Controller
          name="confirmPassword"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="confirmPassword">{t("confirmPassword")}</FieldLabel>
              <Input {...field} id="confirmPassword" type="password" autoComplete="new-password" aria-invalid={fieldState.invalid} />
              {fieldState.invalid && <FieldError>{err("confirmPassword")}</FieldError>}
            </Field>
          )}
        />
        <Controller
          name="acceptTerms"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field orientation="horizontal" data-invalid={fieldState.invalid}>
              <Checkbox
                id="acceptTerms"
                checked={field.value === true}
                onCheckedChange={(v) => field.onChange(v === true)}
                aria-invalid={fieldState.invalid}
              />
              <div className="space-y-1">
                <FieldLabel htmlFor="acceptTerms" className="font-normal">
                  {t.rich("acceptTerms", {
                    terms: (chunks) => (
                      <Link href="/terms" className="underline underline-offset-2">
                        {chunks}
                      </Link>
                    ),
                    privacy: (chunks) => (
                      <Link href="/privacy" className="underline underline-offset-2">
                        {chunks}
                      </Link>
                    ),
                  })}
                </FieldLabel>
                {fieldState.invalid && <FieldError>{err("acceptTerms")}</FieldError>}
              </div>
            </Field>
          )}
        />
      </FieldGroup>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t("submitting") : t("submit")}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {t("haveAccount")}{" "}
        <Link href="/login" className="font-medium text-foreground underline underline-offset-2">
          {t("signIn")}
        </Link>
      </p>
    </form>
  );
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { signInSchema, type SignInInput } from "@/lib/schemas/auth";
import { signIn, type SignInError } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations("auth");
  const [serverError, setServerError] = useState<SignInError | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "", next },
  });

  const onSubmit = form.handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const result = await signIn(values);
      if (result && !result.ok) setServerError(result.error);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {serverError && (
        <Alert variant="destructive" aria-live="polite">
          <AlertDescription>{t(`errors.${serverError}`)}</AlertDescription>
        </Alert>
      )}
      <FieldGroup>
        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="email">{t("login.email")}</FieldLabel>
              <Input
                {...field}
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError>{t("errors.invalidInput")}</FieldError>}
            </Field>
          )}
        />
        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="password">{t("login.password")}</FieldLabel>
              <Input
                {...field}
                id="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid && <FieldError>{t("errors.invalidInput")}</FieldError>}
            </Field>
          )}
        />
      </FieldGroup>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t("login.submitting") : t("login.submit")}
      </Button>
    </form>
  );
}

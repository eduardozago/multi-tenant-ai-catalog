import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, AlertDescription } from "@multi-tenant-ai-catalog/ui/components/alert";
import { Button } from "@multi-tenant-ai-catalog/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@multi-tenant-ai-catalog/ui/components/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@multi-tenant-ai-catalog/ui/components/field";
import { Input } from "@multi-tenant-ai-catalog/ui/components/input";
import { Link } from "@tanstack/react-router";
import { AlertCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { PasswordInput } from "@/components/password-input";
import { applyFieldErrors, getErrorMessage } from "@/lib/form-errors";

import { useRegister } from "../hooks";
import { type RegisterFormInput, registerSchema } from "../schemas";

const SERVER_FIELDS = ["companyName", "name", "email", "password"] as const;

export function RegisterForm({ redirect, onSuccess }: { redirect?: string; onSuccess: () => void }) {
  const registerMutation = useRegister();
  // Errors mapped onto fields are not repeated in the banner.
  const [bannerError, setBannerError] = useState<string | null>(null);
  const form = useForm<RegisterFormInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { companyName: "", name: "", email: "", password: "", confirmPassword: "" },
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit(({ confirmPassword: _, ...input }) => {
    setBannerError(null);
    registerMutation.mutate(input, {
      onSuccess,
      onError: (error) => {
        if (!applyFieldErrors(error, form.setError, SERVER_FIELDS)) {
          setBannerError(getErrorMessage(error));
        }
      },
    });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Cadastrar empresa</CardTitle>
        <CardDescription>Crie a conta da sua empresa em menos de um minuto.</CardDescription>
      </CardHeader>
      <form onSubmit={submit} noValidate>
        <CardContent>
          <FieldGroup>
            {bannerError && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertDescription>{bannerError}</AlertDescription>
              </Alert>
            )}
            <Field data-invalid={!!errors.companyName}>
              <FieldLabel htmlFor="register-company">Nome da empresa</FieldLabel>
              <Input
                id="register-company"
                autoComplete="organization"
                autoFocus
                aria-invalid={!!errors.companyName}
                {...form.register("companyName")}
              />
              <FieldError errors={[errors.companyName]} />
            </Field>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="register-name">Seu nome</FieldLabel>
              <Input
                id="register-name"
                autoComplete="name"
                aria-invalid={!!errors.name}
                {...form.register("name")}
              />
              <FieldDescription>Você será o administrador da nova empresa.</FieldDescription>
              <FieldError errors={[errors.name]} />
            </Field>
            <Field data-invalid={!!errors.email}>
              <FieldLabel htmlFor="register-email">Email</FieldLabel>
              <Input
                id="register-email"
                type="email"
                autoComplete="email"
                aria-invalid={!!errors.email}
                {...form.register("email")}
              />
              <FieldError errors={[errors.email]} />
            </Field>
            <Field data-invalid={!!errors.password}>
              <FieldLabel htmlFor="register-password">Senha</FieldLabel>
              <PasswordInput
                id="register-password"
                autoComplete="new-password"
                aria-invalid={!!errors.password}
                aria-describedby="register-password-hint"
                {...form.register("password")}
              />
              <FieldDescription id="register-password-hint">Mínimo de 8 caracteres.</FieldDescription>
              <FieldError errors={[errors.password]} />
            </Field>
            <Field data-invalid={!!errors.confirmPassword}>
              <FieldLabel htmlFor="register-confirm-password">Confirmar senha</FieldLabel>
              <PasswordInput
                id="register-confirm-password"
                autoComplete="new-password"
                aria-invalid={!!errors.confirmPassword}
                {...form.register("confirmPassword")}
              />
              <FieldError errors={[errors.confirmPassword]} />
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="mt-6 flex-col gap-4">
          <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
            {registerMutation.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Criar conta
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Já tem conta?{" "}
            <Link
              to="/login"
              search={{ redirect }}
              className="text-foreground underline underline-offset-4"
            >
              Entrar
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

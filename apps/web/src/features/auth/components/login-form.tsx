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
import { Field, FieldError, FieldGroup, FieldLabel } from "@multi-tenant-ai-catalog/ui/components/field";
import { Input } from "@multi-tenant-ai-catalog/ui/components/input";
import { Separator } from "@multi-tenant-ai-catalog/ui/components/separator";
import { Link } from "@tanstack/react-router";
import { AlertCircle, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";

import { PasswordInput } from "@/components/password-input";
import { ENV } from "@/env";
import { getErrorMessage } from "@/lib/form-errors";

import { useLogin } from "../hooks";
import { type LoginInput, loginSchema } from "../schemas";
import { DemoAccounts } from "./demo-accounts";

export function LoginForm({ redirect, onSuccess }: { redirect?: string; onSuccess: () => void }) {
  const login = useLogin();
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit((values) => {
    login.mutate(values, { onSuccess });
  });

  // Fill the form visibly, then submit, so a role switch is a single click.
  const loginAs = (credentials: LoginInput) => {
    form.setValue("email", credentials.email, { shouldValidate: true });
    form.setValue("password", credentials.password, { shouldValidate: true });
    void submit();
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Entrar</CardTitle>
          <CardDescription>Acesse o catálogo da sua empresa.</CardDescription>
        </CardHeader>
        <form onSubmit={submit} noValidate>
          <CardContent>
            <FieldGroup>
              {login.isError && (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertDescription>{getErrorMessage(login.error)}</AlertDescription>
                </Alert>
              )}
              {redirect && !login.isError && (
                <Alert>
                  <AlertDescription>Entre para continuar.</AlertDescription>
                </Alert>
              )}
              <Field data-invalid={!!errors.email}>
                <FieldLabel htmlFor="login-email">Email</FieldLabel>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  aria-invalid={!!errors.email}
                  {...form.register("email")}
                />
                <FieldError errors={[errors.email]} />
              </Field>
              <Field data-invalid={!!errors.password}>
                <FieldLabel htmlFor="login-password">Senha</FieldLabel>
                <PasswordInput
                  id="login-password"
                  autoComplete="current-password"
                  aria-invalid={!!errors.password}
                  {...form.register("password")}
                />
                <FieldError errors={[errors.password]} />
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter className="mt-6 flex-col gap-4">
            <Button type="submit" className="w-full" disabled={login.isPending}>
              {login.isPending && <Loader2 className="animate-spin" aria-hidden />}
              Entrar
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Ainda não tem conta?{" "}
              <Link
                to="/register"
                search={{ redirect }}
                className="text-foreground underline underline-offset-4"
              >
                Cadastre sua empresa
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>

      {ENV.VITE_SHOW_DEMO_ACCOUNTS && (
        <>
          <Separator />
          <DemoAccounts onSelect={loginAs} disabled={login.isPending} />
        </>
      )}
    </div>
  );
}

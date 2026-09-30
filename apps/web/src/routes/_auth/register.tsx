import { createFileRoute, useRouter } from "@tanstack/react-router";

import { RegisterForm } from "@/features/auth/components/register-form";
import { redirectSearchSchema, safeRedirect } from "@/lib/redirect";

export const Route = createFileRoute("/_auth/register")({
  validateSearch: redirectSearchSchema,
  head: () => ({ meta: [{ title: "Cadastrar empresa · Catálogo IA" }] }),
  component: RegisterPage,
});

function RegisterPage() {
  const { redirect } = Route.useSearch();
  const router = useRouter();

  return (
    <RegisterForm
      redirect={redirect}
      onSuccess={() => router.history.push(safeRedirect(redirect))}
    />
  );
}

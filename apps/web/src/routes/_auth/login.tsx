import { createFileRoute, useRouter } from "@tanstack/react-router";

import { LoginForm } from "@/features/auth/components/login-form";
import { redirectSearchSchema, safeRedirect } from "@/lib/redirect";

export const Route = createFileRoute("/_auth/login")({
  validateSearch: redirectSearchSchema,
  head: () => ({ meta: [{ title: "Entrar · Catálogo IA" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect } = Route.useSearch();
  const router = useRouter();

  // `redirect` is a full path with its own search string, so it goes through history as-is.
  return <LoginForm redirect={redirect} onSuccess={() => router.history.push(safeRedirect(redirect))} />;
}

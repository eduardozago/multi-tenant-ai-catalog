import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { AuthLayout } from "@/features/auth/components/auth-layout";
import { sessionQueryOptions } from "@/features/auth/hooks";

/** Public layout for /login and /register. Someone already signed in has nothing to do here. */
export const Route = createFileRoute("/_auth")({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(sessionQueryOptions);
    if (user) throw redirect({ to: "/" });
  },
  component: () => (
    <AuthLayout>
      <Outlet />
    </AuthLayout>
  ),
});

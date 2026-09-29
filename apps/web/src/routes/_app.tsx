import { Separator } from "@multi-tenant-ai-catalog/ui/components/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@multi-tenant-ai-catalog/ui/components/sidebar";
import {
  Outlet,
  createFileRoute,
  redirect,
  useNavigate,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { sessionQueryOptions, useSession } from "@/features/auth/hooks";

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context, location }) => {
    // First load waits for /auth/me; later navigations use the cached user and
    // re-check it in the background (see sessionQueryOptions).
    const user = await context.queryClient.ensureQueryData({
      ...sessionQueryOptions,
      revalidateIfStale: true,
    });
    if (!user) throw redirect({ to: "/login", search: { redirect: location.href } });
  },
  component: AppLayout,
});

function AppLayout() {
  const { user } = useSession();
  const router = useRouter();
  const navigate = useNavigate();
  const isNavigating = useRouterState({ select: (state) => state.status === "pending" });

  // A background /auth/me found no session (cookie removed or expired) while the user
  // stayed on the page. Logout and the 401 handler navigate on their own, so while a
  // navigation is pending this does nothing. Not <Navigate>: it re-navigates on every
  // render, and each navigation re-renders this layout, which loops forever.
  useEffect(() => {
    if (user || isNavigating) return;
    void navigate({ to: "/login", search: { redirect: router.state.location.href }, replace: true });
  }, [user, isNavigating, navigate, router]);

  // Never render pages without a user (they would flash the 403 state on the way out).
  if (!user) return null;

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger aria-label="Alternar menu lateral" />
          <Separator orientation="vertical" className="h-4" />
          <span className="truncate text-sm font-medium">{user.company.name}</span>
        </header>
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

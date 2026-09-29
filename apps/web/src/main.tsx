import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import ReactDOM from "react-dom/client";

import { RouteError } from "./components/route-error";
import Loader from "./components/loader";
import { resetSession } from "./features/auth/hooks";
import { ApiError, setUnauthorizedHandler } from "./lib/api-client";
import { routeTree } from "./routeTree.gen";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 4xx answers (401, 403, 404, validation) will not change on retry; only retry transient failures.
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status >= 400 && error.status < 500) &&
        failureCount < 2,
    },
  },
});

const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  // Preloaded data lives in TanStack Query, so the router should not cache it a second time.
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
  defaultPendingComponent: () => <Loader />,
  defaultErrorComponent: RouteError,
  context: { queryClient },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Session expired or cookie removed while using the app: drop all cached data
// and send the user to /login, remembering where they were.
setUnauthorizedHandler(() => {
  const { pathname, href } = router.state.location;
  resetSession(queryClient);
  if (pathname === "/login" || pathname === "/register") return;
  void router.navigate({ to: "/login", search: { redirect: href } });
});

const rootElement = document.getElementById("app");

if (!rootElement) {
  throw new Error("Root element not found");
}

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

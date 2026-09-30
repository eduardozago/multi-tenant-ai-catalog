import { type QueryClient, queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { type AuthUser, login, logout, me, register } from "./api";

export const sessionQueryKey = ["auth", "me"] as const;

/**
 * The session lives only in this query. staleTime 0 plus `revalidateIfStale`
 * in the _app guard means every navigation re-checks /auth/me in the background:
 * the UI never waits for it, but a removed or expired cookie is noticed on the
 * next navigation even on pages that make no other request.
 */
export const sessionQueryOptions = queryOptions({
  queryKey: sessionQueryKey,
  queryFn: async ({ client }) => {
    const user = await me();
    // The cookie now belongs to someone else (logout and login as another user in another
    // tab): drop everything cached for the previous one before the new user is shown, as
    // login does. Without this, a failed refetch keeps the previous user's data on screen.
    const previous = client.getQueryData<AuthUser | null>(sessionQueryKey);
    if (previous && user && (previous.id !== user.id || previous.company.id !== user.company.id)) {
      client.removeQueries({ predicate: (query) => query.queryKey[0] !== sessionQueryKey[0] });
    }
    return user;
  },
  staleTime: 0,
  retry: false,
});

/** Drops every cached query (other tenant's data included) and records "no session". */
export function resetSession(queryClient: QueryClient): void {
  queryClient.removeQueries();
  // Seed null so /login's guard does not refetch and bounce the user back.
  queryClient.setQueryData(sessionQueryKey, null);
}

export function useSession() {
  const { data: user = null } = useQuery(sessionQueryOptions);
  return { user, role: user?.role ?? null };
}

function useStoreSession() {
  const queryClient = useQueryClient();
  return (user: AuthUser) => {
    // A new session never sees data cached by the previous one, however that one ended
    // (logout, 401, or a background /auth/me that found the cookie gone).
    queryClient.removeQueries();
    // The response already carries the user, so no extra /auth/me round trip.
    queryClient.setQueryData(sessionQueryKey, user);
  };
}

export function useLogin() {
  const storeSession = useStoreSession();
  return useMutation({ mutationFn: login, onSuccess: storeSession });
}

export function useRegister() {
  const storeSession = useStoreSession();
  return useMutation({ mutationFn: register, onSuccess: storeSession });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: logout,
    // Even if the request fails, the user asked to leave: drop local state anyway.
    onSettled: async () => {
      resetSession(queryClient);
      await navigate({ to: "/login" });
    },
  });
}

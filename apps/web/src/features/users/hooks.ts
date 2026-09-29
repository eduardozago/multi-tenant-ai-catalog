import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createUser, listUsers } from "./api";

export const usersQueryKey = ["users"] as const;

export const usersQueryOptions = queryOptions({ queryKey: usersQueryKey, queryFn: listUsers });

export function useUsers() {
  return useQuery(usersQueryOptions);
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usersQueryKey }),
  });
}

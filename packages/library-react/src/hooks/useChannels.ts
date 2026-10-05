import {
  createChannelBinding,
  deleteChannelBinding,
  listChannelBindings,
  updateChannelBinding,
} from "@ngriffin_uk/polychat-library-client";
import type { UpdateChannelBindingInput } from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuthStatus } from "./useAuth.js";

export const CHANNEL_BINDINGS_QUERY_KEY = ["channel-bindings"] as const;

export function useChannelBindings() {
  const { isAuthenticated } = useAuthStatus();

  return useQuery({
    queryKey: CHANNEL_BINDINGS_QUERY_KEY,
    queryFn: listChannelBindings,
    enabled: isAuthenticated,
    staleTime: 30_000,
  });
}

export function useCreateChannelBinding() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: createChannelBinding,
    onSuccess: () => client.invalidateQueries({ queryKey: CHANNEL_BINDINGS_QUERY_KEY }),
  });
}

export function useUpdateChannelBinding() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateChannelBindingInput }) =>
      updateChannelBinding(id, input),
    onSuccess: () => client.invalidateQueries({ queryKey: CHANNEL_BINDINGS_QUERY_KEY }),
  });
}

export function useDeleteChannelBinding() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: deleteChannelBinding,
    onSuccess: () => client.invalidateQueries({ queryKey: CHANNEL_BINDINGS_QUERY_KEY }),
  });
}

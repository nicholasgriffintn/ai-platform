import {
  disconnectRecipeConnector,
  searchConnectorPlaces,
  getRecipeConnector,
  listRecipeConnectorAccounts,
  listRecipeConnectors,
  startRecipeConnector,
  storeRecipeConnectorApiKey,
  updateRecipeConnectorAccount,
  useChatStore,
} from "@ngriffin_uk/polychat-library-client";
import type {
  RecipeConnectorAccount,
  RecipeConnectorProvider,
  RecipeConnectorStatus,
} from "@ngriffin_uk/polychat-schemas";
import { useDebouncedValue } from "@ngriffin_uk/polychat-utility-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useCanAccessProFeatures } from "./useCanAccessProFeatures.js";

export const RECIPE_CONNECTORS_QUERY_KEY = ["recipe-connectors"] as const;
export const recipeConnectorAccountsQueryKey = (provider: RecipeConnectorProvider) =>
  [...RECIPE_CONNECTORS_QUERY_KEY, provider, "accounts"] as const;

export function useRecipeConnectors({
  enabled = true,
  status,
}: { enabled?: boolean; status?: RecipeConnectorStatus } = {}) {
  const canAccessProFeatures = useCanAccessProFeatures();
  const isEnabled = canAccessProFeatures && enabled;
  const query = useQuery({
    queryKey: [...RECIPE_CONNECTORS_QUERY_KEY, { status: status ?? "all" }],
    queryFn: () => listRecipeConnectors({ status }),
    enabled: isEnabled,
    staleTime: 60 * 1000,
  });

  return {
    ...query,
    data: isEnabled ? query.data : undefined,
    error: isEnabled ? query.error : null,
    isFetching: isEnabled ? query.isFetching : false,
    isLoading: isEnabled ? query.isLoading : false,
  };
}

export function useRecipeConnector(provider: RecipeConnectorProvider) {
  const canAccessProFeatures = useCanAccessProFeatures();

  return useQuery({
    queryKey: [...RECIPE_CONNECTORS_QUERY_KEY, provider],
    queryFn: () => getRecipeConnector(provider),
    enabled: canAccessProFeatures,
    staleTime: 60 * 1000,
  });
}

export function useStartRecipeConnector() {
  return useMutation({
    mutationFn: ({
      provider,
      returnTo,
      authConfigId,
    }: {
      provider: Parameters<typeof startRecipeConnector>[0];
      returnTo?: string;
      authConfigId?: string;
    }) => startRecipeConnector(provider, returnTo, authConfigId),
  });
}

export function useDisconnectRecipeConnector() {
  return useMutation({
    mutationFn: disconnectRecipeConnector,
  });
}

export function useStoreRecipeConnectorApiKey() {
  return useMutation({
    mutationFn: ({
      provider,
      credentials,
    }: {
      provider: Parameters<typeof storeRecipeConnectorApiKey>[0];
      credentials: string[];
    }) => storeRecipeConnectorApiKey(provider, { credentials }),
  });
}

export function useRecipeConnectorAccounts(provider: RecipeConnectorProvider) {
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);

  return useQuery({
    queryKey: recipeConnectorAccountsQueryKey(provider),
    queryFn: () => listRecipeConnectorAccounts(provider),
    enabled: isAuthenticated,
    staleTime: 30 * 1000,
  });
}

export function useUpdateRecipeConnectorAccount(provider: RecipeConnectorProvider) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: Parameters<typeof updateRecipeConnectorAccount>[1]) =>
      updateRecipeConnectorAccount(provider, request),
    onSuccess: (updatedAccount) => {
      queryClient.setQueryData<{ accounts: RecipeConnectorAccount[] }>(
        recipeConnectorAccountsQueryKey(provider),
        (current) => ({
          accounts: (current?.accounts ?? []).map((account) => ({
            ...account,
            isSelected: updatedAccount.isSelected
              ? account.id === updatedAccount.id
              : account.isSelected,
            ...(account.id === updatedAccount.id ? updatedAccount : {}),
          })),
        }),
      );
    },
  });
}

export function useConnectorPlaces(
  provider: RecipeConnectorProvider,
  input: string,
  enabled: boolean,
) {
  const query = useDebouncedValue(input.trim(), 350);

  return useQuery({
    queryKey: [...RECIPE_CONNECTORS_QUERY_KEY, provider, "places", query],
    queryFn: () => searchConnectorPlaces(provider, query),
    enabled: enabled && query.length >= 2,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

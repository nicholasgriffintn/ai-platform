import type {
  RecipeConnectorAccount,
  RecipeConnectorProvider,
} from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  disconnectRecipeConnector,
  listRecipeConnectorAccounts,
  listRecipeConnectors,
  startRecipeConnector,
  storeRecipeConnectorApiKey,
  updateRecipeConnectorAccount,
} from "~/lib/api/connectors";

import { useCanAccessProFeatures } from "./useCanAccessProFeatures";

export const RECIPE_CONNECTORS_QUERY_KEY = ["recipe-connectors"] as const;
export const recipeConnectorAccountsQueryKey = (provider: RecipeConnectorProvider) =>
  [...RECIPE_CONNECTORS_QUERY_KEY, provider, "accounts"] as const;

export function useRecipeConnectors({ enabled = true }: { enabled?: boolean } = {}) {
  const canAccessProFeatures = useCanAccessProFeatures();
  const isEnabled = canAccessProFeatures && enabled;
  const query = useQuery({
    queryKey: RECIPE_CONNECTORS_QUERY_KEY,
    queryFn: listRecipeConnectors,
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
      apiKey,
    }: {
      provider: Parameters<typeof storeRecipeConnectorApiKey>[0];
      apiKey: string;
    }) => storeRecipeConnectorApiKey(provider, { apiKey }),
  });
}

export function useRecipeConnectorAccounts(provider: RecipeConnectorProvider) {
  return useQuery({
    queryKey: recipeConnectorAccountsQueryKey(provider),
    queryFn: () => listRecipeConnectorAccounts(provider),
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

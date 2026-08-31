import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiService } from "~/lib/api/api-service";

import { MODELS_QUERY_KEY } from "./useModels";
import { REALTIME_PROVIDERS_QUERY_KEY } from "./useRealtimeProviders";

export const USER_QUERY_KEYS = {
  providerSettings: ["user", "provider-settings"],
  providerSyncStatus: ["user", "provider-sync-status"],
} as const;

function invalidateProviderReadiness(queryClient: ReturnType<typeof useQueryClient>): void {
  void queryClient.invalidateQueries({ queryKey: [MODELS_QUERY_KEY] });
  void queryClient.invalidateQueries({ queryKey: REALTIME_PROVIDERS_QUERY_KEY });
}

export function useUser(options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();

  const { data: providerSettings, isLoading: isLoadingProviderSettings } = useQuery({
    queryKey: USER_QUERY_KEYS.providerSettings,
    queryFn: () => apiService.getProviderSettings(),
    enabled: options?.enabled ?? true,
  });
  const { data: providerSyncStatus, isLoading: isLoadingProviderSyncStatus } = useQuery({
    queryKey: USER_QUERY_KEYS.providerSyncStatus,
    queryFn: () => apiService.getProviderSyncStatus(),
    enabled: options?.enabled ?? true,
  });

  const storeProviderApiKeyMutation = useMutation({
    mutationFn: async ({
      providerId,
      apiKey,
      secretKey,
      configuration,
    }: {
      providerId: string;
      apiKey: string;
      secretKey?: string;
      configuration?: Record<string, unknown>;
    }) => {
      await apiService.storeProviderApiKey(providerId, apiKey, secretKey, configuration);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: USER_QUERY_KEYS.providerSettings,
      });
      invalidateProviderReadiness(queryClient);
    },
  });

  const syncProvidersMutation = useMutation({
    mutationFn: async () => {
      await apiService.syncProviders();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: USER_QUERY_KEYS.providerSettings,
      });
      invalidateProviderReadiness(queryClient);
      void queryClient.invalidateQueries({
        queryKey: USER_QUERY_KEYS.providerSyncStatus,
      });
    },
  });

  const deleteProviderApiKeyMutation = useMutation({
    mutationFn: async ({ providerId }: { providerId: string }) => {
      await apiService.deleteProviderApiKey(providerId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: USER_QUERY_KEYS.providerSettings,
      });
      invalidateProviderReadiness(queryClient);
    },
  });

  return {
    providerSettings: providerSettings ?? [],
    isLoadingProviderSettings,
    providerSyncRequired: providerSyncStatus?.required ?? false,
    isLoadingProviderSyncStatus,
    storeProviderApiKey: storeProviderApiKeyMutation.mutateAsync,
    isStoringProviderApiKey: storeProviderApiKeyMutation.isPending,
    syncProviders: syncProvidersMutation.mutate,
    isSyncingProviders: syncProvidersMutation.isPending,
    deleteProviderApiKey: deleteProviderApiKeyMutation.mutateAsync,
    isDeletingProviderApiKey: deleteProviderApiKeyMutation.isPending,
  };
}

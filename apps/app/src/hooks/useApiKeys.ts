import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiService } from "~/lib/api/api-service";

interface ApiKey {
  id: string;
  name: string;
  created_at: string;
}

interface NewApiKeyResponse extends ApiKey {
  apiKey: string;
}

export const API_KEY_QUERY_KEYS = {
  all: ["api-keys"],
} as const;

export function useApiKeys() {
  const queryClient = useQueryClient();

  const {
    data: apiKeys,
    isLoading: isLoadingApiKeys,
    error: errorLoadingApiKeys,
  } = useQuery<ApiKey[]>({
    queryKey: API_KEY_QUERY_KEYS.all,
    queryFn: () => apiService.getUserApiKeys(),
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  const createApiKeyMutation = useMutation<
    NewApiKeyResponse,
    Error,
    { name?: string }
  >({
    mutationFn: ({ name }) => apiService.createApiKey(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: API_KEY_QUERY_KEYS.all });
    },
  });

  const deleteApiKeyMutation = useMutation<void, Error, { keyId: string }>({
    mutationFn: ({ keyId }) => apiService.deleteApiKey(keyId),
    onSuccess: (_) => {
      queryClient.invalidateQueries({ queryKey: API_KEY_QUERY_KEYS.all });
    },
  });

  return {
    apiKeys: apiKeys || [],
    isLoadingApiKeys,
    errorLoadingApiKeys,
    createApiKey: createApiKeyMutation.mutateAsync,
    isCreatingApiKey: createApiKeyMutation.isPending,
    errorCreatingApiKey: createApiKeyMutation.error,
    deleteApiKey: deleteApiKeyMutation.mutate,
    isDeletingApiKey: deleteApiKeyMutation.isPending,
    errorDeletingApiKey: deleteApiKeyMutation.error,
  };
}

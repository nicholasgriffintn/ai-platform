import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiService } from "~/lib/api/api-service";

export const USER_QUERY_KEYS = {
	providerSettings: ["user", "provider-settings"],
} as const;

export function useUser() {
	const queryClient = useQueryClient();

	const { data: providerSettings, isLoading: isLoadingProviderSettings } =
		useQuery({
			queryKey: USER_QUERY_KEYS.providerSettings,
			queryFn: () => apiService.getProviderSettings(),
		});

	const storeProviderApiKeyMutation = useMutation({
		mutationFn: async ({
			providerId,
			apiKey,
			secretKey,
		}: {
			providerId: string;
			apiKey: string;
			secretKey?: string;
		}) => {
			await apiService.storeProviderApiKey(providerId, apiKey, secretKey);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: USER_QUERY_KEYS.providerSettings,
			});
		},
	});

	const syncProvidersMutation = useMutation({
		mutationFn: async () => {
			await apiService.syncProviders();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: USER_QUERY_KEYS.providerSettings,
			});
		},
	});

	return {
		providerSettings: providerSettings?.providers,
		isLoadingProviderSettings,
		storeProviderApiKey: storeProviderApiKeyMutation.mutate,
		isStoringProviderApiKey: storeProviderApiKeyMutation.isPending,
		syncProviders: syncProvidersMutation.mutate,
		isSyncingProviders: syncProvidersMutation.isPending,
	};
}

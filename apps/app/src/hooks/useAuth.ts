import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { authService } from "~/lib/api/auth-service";
import { useChatStore } from "~/state/stores/chatStore";
import { useUsageStore } from "~/state/stores/usageStore";
import type { UserSettings } from "~/types";

export const AUTH_QUERY_KEYS = {
	authStatus: ["auth", "status"],
};

export function useAuthStatus() {
	const {
		isAuthenticated,
		isAuthenticationLoading,
		user,
		userSettings,
		setIsAuthenticationLoading,
		setAuthenticatedUserConfiguration,
		setUserSettings,
		clearAuthenticatedUserConfiguration,
	} = useChatStore();
	const queryClient = useQueryClient();

	const { isLoading: isAuthLoading } = useQuery({
		queryKey: AUTH_QUERY_KEYS.authStatus,
		queryFn: async () => {
			const isAuth = await authService.checkAuthStatus();

			if (isAuth) {
				const token = await authService.getToken();
				const user = authService.getUser();
				const userSettings = authService.getUserSettings();
				setAuthenticatedUserConfiguration({
					hasApiKey: !!token,
					user,
					userSettings,
				});
			} else {
				clearAuthenticatedUserConfiguration();
			}
			setIsAuthenticationLoading(false);

			return isAuth;
		},
		staleTime: 1000 * 60 * 5, // 5 minutes
	});

	const loginWithGithub = () => {
		setIsAuthenticationLoading(true);
		authService.initiateGithubLogin();
	};

	const logoutMutation = useMutation({
		mutationFn: async () => {
			setIsAuthenticationLoading(true);
			const success = await authService.logout();
			if (success) {
				clearAuthenticatedUserConfiguration();
				setIsAuthenticationLoading(false);
				// Clear usage limits when user logs out
				useUsageStore.getState().setUsageLimits(null);
				return true;
			}
			return false;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.authStatus });
		},
	});

	const updateUserSettingsMutation = useMutation({
		mutationFn: async (settings: Partial<UserSettings>) => {
			const didUpdate = await authService.updateUserSettings(settings);
			if (!didUpdate) {
				throw new Error("Failed to update user settings");
			}

			return true;
		},
		onSuccess: async () => {
			setUserSettings(authService.getUserSettings());
			await queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.authStatus });
		},
	});

	return {
		isAuthenticated,
		isLoading: isAuthenticationLoading || isAuthLoading,
		user,
		userSettings,
		loginWithGithub,
		logout: logoutMutation.mutate,
		isLoggingOut: logoutMutation.isPending,
		updateUserSettings: updateUserSettingsMutation.mutateAsync,
		isUpdatingUserSettings: updateUserSettingsMutation.isPending,
	};
}

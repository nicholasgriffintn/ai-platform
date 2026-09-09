import { authService, useChatStore } from "@ngriffin_uk/polychat-library-client";
import type { UserSettings } from "@ngriffin_uk/polychat-schemas/user-profile";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { MODELS_QUERY_KEY } from "../chat/useModels.js";
import { useUsageStore } from "../state/usageStore.js";

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
    setHasApiKey,
    setUserSettings,
    clearAuthenticatedUserConfiguration,
  } = useChatStore();
  const queryClient = useQueryClient();

  const authStatusQuery = useQuery({
    queryKey: AUTH_QUERY_KEYS.authStatus,
    queryFn: async () => {
      const previousIdentity = useChatStore.getState();
      const isAuth = await authService.checkAuthStatus();

      const user = authService.getUser();

      if (isAuth) {
        const userSettings = authService.getUserSettings();

        setAuthenticatedUserConfiguration({
          hasApiKey: previousIdentity.hasApiKey,
          user,
          userSettings,
        });
        void authService.getToken().then((token) => setHasApiKey(Boolean(token)));
      } else {
        clearAuthenticatedUserConfiguration();
      }

      if (previousIdentity.isAuthenticated !== isAuth || previousIdentity.user?.id !== user?.id) {
        useUsageStore.getState().setUsageLimits(null);
        void queryClient.invalidateQueries({ queryKey: [MODELS_QUERY_KEY] });
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
        useUsageStore.getState().setUsageLimits(null);

        return true;
      }

      return false;
    },
    onSuccess: (didLogout) => {
      if (didLogout) {
        queryClient.clear();

        return;
      }

      void queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.authStatus });
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
    isLoading: isAuthenticationLoading || authStatusQuery.isLoading,
    refreshAuthStatus: authStatusQuery.refetch,
    user,
    userSettings,
    loginWithGithub,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
    updateUserSettings: updateUserSettingsMutation.mutateAsync,
    isUpdatingUserSettings: updateUserSettingsMutation.isPending,
  };
}

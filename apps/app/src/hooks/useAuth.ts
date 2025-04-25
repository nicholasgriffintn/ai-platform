import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { authService } from "~/lib/api/auth-service";
import { useChatStore } from "~/state/stores/chatStore";
import { useUsageStore } from "~/state/stores/usageStore";

export const AUTH_QUERY_KEYS = {
  authStatus: ["auth", "status"],
  user: ["auth", "user"],
  userSettings: ["auth", "userSettings"],
};

export function useAuthStatus() {
  const {
    setHasApiKey,
    setIsAuthenticated,
    setIsAuthenticationLoading,
    setIsPro,
  } = useChatStore();
  const queryClient = useQueryClient();

  const { data: isAuthenticated, isLoading: isAuthLoading } = useQuery({
    queryKey: AUTH_QUERY_KEYS.authStatus,
    queryFn: async () => {
      const isAuth = await authService.checkAuthStatus();
      setIsAuthenticated(isAuth);

      if (isAuth) {
        const token = await authService.getToken();
        setHasApiKey(!!token);

        const user = authService.getUser();
        setIsPro(user?.plan_id === "pro");
      } else {
        setIsPro(false);
      }
      setIsAuthenticationLoading(false);

      return isAuth;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const { data: user, isLoading: isUserLoading } = useQuery({
    queryKey: AUTH_QUERY_KEYS.user,
    queryFn: () => authService.getUser(),
    enabled: !!isAuthenticated,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const { data: userSettings, isLoading: isUserSettingsLoading } = useQuery({
    queryKey: AUTH_QUERY_KEYS.userSettings,
    queryFn: () => authService.getUserSettings(),
    enabled: !!isAuthenticated,
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
        setIsAuthenticated(false);
        setHasApiKey(false);
        setIsAuthenticationLoading(false);
        // Clear usage limits when user logs out
        useUsageStore.getState().setUsageLimits(null);
        return true;
      }
      return false;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.authStatus });
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.user });
    },
  });

  const updateUserSettingsMutation = useMutation({
    mutationFn: async (settings: Partial<any>) => {
      return await authService.updateUserSettings(settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.userSettings });
    },
  });

  return {
    isAuthenticated: !!isAuthenticated,
    isLoading: isAuthLoading || isUserLoading || isUserSettingsLoading,
    user,
    userSettings,
    loginWithGithub,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
    updateUserSettings: updateUserSettingsMutation.mutate,
    isUpdatingUserSettings: updateUserSettingsMutation.isPending,
  };
}

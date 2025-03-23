import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { authService } from "~/lib/api/auth-service";
import { useChatStore } from "~/state/stores/chatStore";

export const AUTH_QUERY_KEYS = {
	authStatus: ["auth", "status"],
	user: ["auth", "user"],
};

export function useAuthStatus() {
	const {
		setHasApiKey,
		setIsAuthenticated,
		setIsAuthenticationLoading,
		setIsPro,
	} = useChatStore();
	const queryClient = useQueryClient();

	const { data: isAuthenticated, isLoading } = useQuery({
		queryKey: AUTH_QUERY_KEYS.authStatus,
		queryFn: async () => {
			const isAuth = await authService.checkAuthStatus();
			setIsAuthenticated(isAuth);

			if (isAuth) {
				const token = await authService.getToken();
				setHasApiKey(!!token);

				const user = authService.getUser();
				setIsPro(user?.plan === "pro");
			} else {
				setIsPro(false);
			}
			setIsAuthenticationLoading(false);

			return isAuth;
		},
		staleTime: 1000 * 60 * 5, // 5 minutes
	});

	const { data: user } = useQuery({
		queryKey: AUTH_QUERY_KEYS.user,
		queryFn: () => authService.getUser(),
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
				return true;
			}
			return false;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.authStatus });
			queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEYS.user });
		},
	});

	return {
		isAuthenticated: !!isAuthenticated,
		isLoading,
		user,
		loginWithGithub,
		logout: logoutMutation.mutate,
		isLoggingOut: logoutMutation.isPending,
	};
}

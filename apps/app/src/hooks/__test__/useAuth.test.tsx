import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { authService } from "~/lib/api/auth-service";
import { useAuthStatus } from "../useAuth";

const setHasApiKey = vi.fn();
const setIsAuthenticated = vi.fn();
const setIsAuthenticationLoading = vi.fn();
const setIsPro = vi.fn();
const setLocalOnlyMode = vi.fn();
const setTemporaryChatsDefault = vi.fn();
const setAuthenticatedUserConfiguration = vi.fn();
const setUserSettings = vi.fn();
const clearAuthenticatedUserConfiguration = vi.fn();

const setUsageLimits = vi.fn();
const storeState = vi.hoisted(() => ({
	value: {
		currentConversationId: undefined as string | undefined,
		isAuthenticated: false,
		isAuthenticationLoading: true,
		user: null as { id: number; plan_id: string } | null,
		userSettings: null as {
			id: string;
			nickname: string;
			temporary_chats_default?: boolean;
		} | null,
	},
}));

vi.mock("~/state/stores/chatStore", () => ({
	useChatStore: () => ({
		...storeState.value,
		setHasApiKey,
		setIsAuthenticated,
		setIsAuthenticationLoading,
		setIsPro,
		setLocalOnlyMode,
		setTemporaryChatsDefault,
		setAuthenticatedUserConfiguration,
		setUserSettings,
		clearAuthenticatedUserConfiguration,
	}),
}));

vi.mock("~/state/stores/usageStore", () => ({
	useUsageStore: {
		getState: () => ({
			setUsageLimits,
		}),
	},
}));

describe("useAuthStatus", () => {
	let currentUserSettings: {
		id: string;
		nickname: string;
		temporary_chats_default?: boolean;
	} | null;

	const createWrapper = () => {
		const queryClient = new QueryClient({
			defaultOptions: {
				queries: {
					retry: false,
				},
			},
		});

		return ({ children }: { children: ReactNode }) => (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);
	};

	beforeEach(() => {
		vi.restoreAllMocks();
		setHasApiKey.mockReset();
		setIsAuthenticated.mockReset();
		setIsAuthenticationLoading.mockReset();
		setIsPro.mockReset();
		setLocalOnlyMode.mockReset();
		setTemporaryChatsDefault.mockReset();
		setAuthenticatedUserConfiguration.mockReset();
		setUserSettings.mockReset();
		clearAuthenticatedUserConfiguration.mockReset();
		setUsageLimits.mockReset();
		setIsAuthenticationLoading.mockImplementation((isAuthenticationLoading: boolean) => {
			storeState.value = {
				...storeState.value,
				isAuthenticationLoading,
			};
		});
		setAuthenticatedUserConfiguration.mockImplementation(
			({
				user,
				userSettings,
			}: {
				hasApiKey: boolean;
				user: typeof storeState.value.user;
				userSettings: typeof storeState.value.userSettings;
			}) => {
				storeState.value = {
					...storeState.value,
					isAuthenticated: true,
					isAuthenticationLoading: false,
					user,
					userSettings,
				};
			},
		);
		setUserSettings.mockImplementation((userSettings: typeof storeState.value.userSettings) => {
			storeState.value = {
				...storeState.value,
				userSettings,
			};
		});
		clearAuthenticatedUserConfiguration.mockImplementation(() => {
			storeState.value = {
				currentConversationId: undefined,
				isAuthenticated: false,
				isAuthenticationLoading: false,
				user: null,
				userSettings: null,
			};
		});
		storeState.value = {
			currentConversationId: undefined,
			isAuthenticated: false,
			isAuthenticationLoading: true,
			user: null,
			userSettings: null,
		};

		currentUserSettings = {
			id: "settings-1",
			nickname: "Nicholas",
		};

		vi.spyOn(authService, "checkAuthStatus").mockResolvedValue(true);
		vi.spyOn(authService, "getToken").mockResolvedValue("token");
		vi.spyOn(authService, "getUser").mockReturnValue({
			id: 1,
			plan_id: "free",
		} as any);
		vi.spyOn(authService as any, "getAnonymousUser").mockReturnValue(null);
		vi.spyOn(authService, "getUserSettings").mockImplementation(() => currentUserSettings as any);
	});

	it("returns an async settings updater and eventually refreshes user settings", async () => {
		vi.spyOn(authService, "updateUserSettings").mockImplementation(async (settings) => {
			currentUserSettings = {
				...(currentUserSettings as {
					id: string;
					nickname: string;
					temporary_chats_default?: boolean;
				}),
				...settings,
			};
			return true;
		});

		const { result } = renderHook(() => useAuthStatus(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(result.current.userSettings?.nickname).toBe("Nicholas");
		});

		let savePromise: Promise<boolean>;
		await act(async () => {
			savePromise = result.current.updateUserSettings({
				nickname: "Updated Nicholas",
			});
			expect(savePromise).toBeInstanceOf(Promise);
			await expect(savePromise).resolves.toBe(true);
		});

		await waitFor(() => {
			expect(result.current.userSettings?.nickname).toBe("Updated Nicholas");
		});
	});

	it("returns the global user configuration snapshot without waiting for local queries", () => {
		storeState.value = {
			currentConversationId: undefined,
			isAuthenticated: true,
			isAuthenticationLoading: false,
			user: {
				id: 1,
				plan_id: "pro",
			},
			userSettings: {
				id: "settings-1",
				nickname: "Store Nicholas",
			},
		};

		const { result } = renderHook(() => useAuthStatus(), {
			wrapper: createWrapper(),
		});

		expect(result.current.isAuthenticated).toBe(true);
		expect(result.current.user?.plan_id).toBe("pro");
		expect(result.current.userSettings?.nickname).toBe("Store Nicholas");
	});

	it("rejects the async settings updater when the save fails", async () => {
		vi.spyOn(authService, "updateUserSettings").mockResolvedValue(false);

		const { result } = renderHook(() => useAuthStatus(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(result.current.isAuthenticated).toBe(true);
		});

		await act(async () => {
			await expect(
				result.current.updateUserSettings({
					nickname: "Updated Nicholas",
				}),
			).rejects.toThrow("Failed to update user settings");
		});
	});

	it("publishes signed-in user settings through the global configuration snapshot", async () => {
		currentUserSettings = {
			id: "settings-1",
			nickname: "Nicholas",
			temporary_chats_default: true,
		};

		renderHook(() => useAuthStatus(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(setAuthenticatedUserConfiguration).toHaveBeenCalledWith(
				expect.objectContaining({
					userSettings: currentUserSettings,
				}),
			);
		});
	});

	it("publishes authenticated user configuration before auth loading completes", async () => {
		const user = {
			id: 1,
			plan_id: "pro",
		};
		vi.spyOn(authService, "getUser").mockReturnValue(user as any);

		renderHook(() => useAuthStatus(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(setAuthenticatedUserConfiguration).toHaveBeenCalledWith({
				hasApiKey: true,
				user,
				userSettings: currentUserSettings,
			});
		});
		expect(setAuthenticatedUserConfiguration.mock.invocationCallOrder[0]).toBeLessThan(
			setIsAuthenticationLoading.mock.invocationCallOrder.at(-1) ?? Number.MAX_SAFE_INTEGER,
		);
	});

	it("hydrates usage limits from anonymous auth status data", async () => {
		vi.spyOn(authService, "checkAuthStatus").mockResolvedValue(false);
		vi.spyOn(authService, "getUser").mockReturnValue(null);
		vi.spyOn(authService as any, "getAnonymousUser").mockReturnValue({
			id: "anon-123",
			daily_message_count: 10,
			daily_reset: "2026-06-24T22:45:48.676Z",
		});

		renderHook(() => useAuthStatus(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => {
			expect(setUsageLimits).toHaveBeenCalledWith({
				daily: {
					used: 10,
					limit: 10,
				},
			});
		});
	});
});

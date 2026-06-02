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

const setUsageLimits = vi.fn();

vi.mock("~/state/stores/chatStore", () => ({
	useChatStore: () => ({
		setHasApiKey,
		setIsAuthenticated,
		setIsAuthenticationLoading,
		setIsPro,
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
	let currentUserSettings: { id: string; nickname: string } | null;

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
		setUsageLimits.mockReset();

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
		vi.spyOn(authService, "getUserSettings").mockImplementation(() => currentUserSettings as any);
	});

	it("returns an async settings updater and eventually refreshes user settings", async () => {
		vi.spyOn(authService, "updateUserSettings").mockImplementation(async (settings) => {
			currentUserSettings = {
				...(currentUserSettings as { id: string; nickname: string }),
				...settings,
			} as { id: string; nickname: string };
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
});

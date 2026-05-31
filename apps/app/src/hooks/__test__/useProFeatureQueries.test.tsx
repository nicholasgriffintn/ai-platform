import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiService } from "~/lib/api/api-service";
import { fetchSandboxConnections, fetchSandboxInstallConfig } from "~/lib/api/sandbox";
import { useChatStore } from "~/state/stores/chatStore";
import { AGENTS_QUERY_KEYS, useAgents } from "../useAgents";
import { SANDBOX_QUERY_KEYS, useSandboxConnections, useSandboxInstallConfig } from "../useSandbox";

vi.mock("~/lib/api/api-service", () => ({
	apiService: {
		listAgents: vi.fn(),
	},
}));

vi.mock("~/lib/api/sandbox", () => ({
	connectSandboxInstallation: vi.fn(),
	deleteSandboxConnection: vi.fn(),
	fetchSandboxConnectionRepositories: vi.fn(),
	fetchSandboxConnections: vi.fn(),
	fetchSandboxInstallConfig: vi.fn(),
	updateSandboxConnectionRepositories: vi.fn(),
	upsertSandboxConnection: vi.fn(),
}));

function createQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
			},
		},
	});
}

function wrapper(queryClient: QueryClient) {
	return ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);
}

function setAccess(isAuthenticated: boolean, isPro: boolean) {
	useChatStore.setState({
		isAuthenticated,
		isAuthenticationLoading: false,
		isPro,
	});
}

describe("Pro feature queries", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setAccess(false, false);
	});

	it.each([
		{ isAuthenticated: false, isPro: false },
		{ isAuthenticated: true, isPro: false },
	])("does not list agents without Pro access: %o", ({ isAuthenticated, isPro }) => {
		setAccess(isAuthenticated, isPro);
		const queryClient = createQueryClient();

		const { result } = renderHook(() => useAgents(), { wrapper: wrapper(queryClient) });

		expect(apiService.listAgents).not.toHaveBeenCalled();
		expect(result.current.agents).toEqual([]);
		expect(result.current.isLoadingAgents).toBe(false);
		expect(result.current.errorAgents).toBeNull();
	});

	it("lists agents for signed-in Pro users", async () => {
		setAccess(true, true);
		vi.mocked(apiService.listAgents).mockResolvedValue([{ id: "agent-1", name: "Agent" }]);
		const queryClient = createQueryClient();

		const { result } = renderHook(() => useAgents(), { wrapper: wrapper(queryClient) });

		await waitFor(() => expect(result.current.agents).toHaveLength(1));
		expect(apiService.listAgents).toHaveBeenCalledTimes(1);
	});

	it("hides cached agents without Pro access", () => {
		const queryClient = createQueryClient();
		queryClient.setQueryData(AGENTS_QUERY_KEYS.all, [{ id: "agent-1", name: "Agent" }]);

		const { result } = renderHook(() => useAgents(), { wrapper: wrapper(queryClient) });

		expect(apiService.listAgents).not.toHaveBeenCalled();
		expect(result.current.agents).toEqual([]);
	});

	it.each([
		{ isAuthenticated: false, isPro: false },
		{ isAuthenticated: true, isPro: false },
	])("does not fetch sandbox data without Pro access: %o", ({ isAuthenticated, isPro }) => {
		setAccess(isAuthenticated, isPro);
		const queryClient = createQueryClient();

		const connections = renderHook(() => useSandboxConnections(), {
			wrapper: wrapper(queryClient),
		});
		const installConfig = renderHook(() => useSandboxInstallConfig(), {
			wrapper: wrapper(queryClient),
		});

		expect(fetchSandboxConnections).not.toHaveBeenCalled();
		expect(fetchSandboxInstallConfig).not.toHaveBeenCalled();
		expect(connections.result.current.data).toBeUndefined();
		expect(connections.result.current.isLoading).toBe(false);
		expect(installConfig.result.current.data).toBeUndefined();
		expect(installConfig.result.current.isLoading).toBe(false);
	});

	it("fetches sandbox data for signed-in Pro users", async () => {
		setAccess(true, true);
		vi.mocked(fetchSandboxConnections).mockResolvedValue([
			{
				installationId: 123,
				appId: "app-1",
				repositories: ["owner/repo"],
				hasWebhookSecret: false,
				createdAt: "2026-05-31T00:00:00.000Z",
				updatedAt: "2026-05-31T00:00:00.000Z",
			},
		]);
		vi.mocked(fetchSandboxInstallConfig).mockResolvedValue({
			canAutoConnect: true,
			installUrl: "https://github.com/apps/test/installations/new",
		});
		const queryClient = createQueryClient();

		const connections = renderHook(() => useSandboxConnections(), {
			wrapper: wrapper(queryClient),
		});
		const installConfig = renderHook(() => useSandboxInstallConfig(), {
			wrapper: wrapper(queryClient),
		});

		await waitFor(() => expect(connections.result.current.data).toHaveLength(1));
		await waitFor(() => expect(installConfig.result.current.data?.canAutoConnect).toBe(true));
		expect(fetchSandboxConnections).toHaveBeenCalledTimes(1);
		expect(fetchSandboxInstallConfig).toHaveBeenCalledTimes(1);
	});

	it("hides cached sandbox data without Pro access", () => {
		const queryClient = createQueryClient();
		queryClient.setQueryData(SANDBOX_QUERY_KEYS.connections(), [
			{
				installationId: 123,
				appId: "app-1",
				repositories: ["owner/repo"],
				hasWebhookSecret: false,
				createdAt: "2026-05-31T00:00:00.000Z",
				updatedAt: "2026-05-31T00:00:00.000Z",
			},
		]);

		const { result } = renderHook(() => useSandboxConnections(), {
			wrapper: wrapper(queryClient),
		});

		expect(fetchSandboxConnections).not.toHaveBeenCalled();
		expect(result.current.data).toBeUndefined();
	});
});

import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";

import {
	connectSandboxInstallation,
	fetchSandboxInstallConfig,
	deleteSandboxConnection,
	fetchSandboxConnectionRepositories,
	fetchSandboxConnections,
	updateSandboxConnectionRepositories,
	upsertSandboxConnection,
} from "~/lib/api/sandbox";
import type {
	ConnectSandboxInstallationInput,
	CreateSandboxConnectionInput,
	SandboxConnection,
	SandboxConnectionRepositoriesPayload,
} from "~/types/sandbox";

export const SANDBOX_QUERY_KEYS = {
	root: ["sandbox"] as const,
	installConfig: () => [...SANDBOX_QUERY_KEYS.root, "install-config"] as const,
	connections: () => [...SANDBOX_QUERY_KEYS.root, "connections"] as const,
	connectionRepositories: (installationId: number) =>
		[...SANDBOX_QUERY_KEYS.root, "connections", installationId, "repositories"] as const,
};

export const useSandboxConnections = () =>
	useQuery({
		queryKey: SANDBOX_QUERY_KEYS.connections(),
		queryFn: () => fetchSandboxConnections(),
	});

export const useSandboxInstallConfig = () =>
	useQuery({
		queryKey: SANDBOX_QUERY_KEYS.installConfig(),
		queryFn: () => fetchSandboxInstallConfig(),
	});

export const useSandboxConnectionRepositories = (installationId?: number) =>
	useQuery({
		queryKey: SANDBOX_QUERY_KEYS.connectionRepositories(installationId ?? 0),
		queryFn: () => fetchSandboxConnectionRepositories(installationId!),
		enabled: Boolean(installationId),
	});

export function useSandboxRepositoryOptions(connections: SandboxConnection[]) {
	const results = useQueries({
		queries: connections.map((connection) => ({
			queryKey: SANDBOX_QUERY_KEYS.connectionRepositories(connection.installationId),
			queryFn: () => fetchSandboxConnectionRepositories(connection.installationId),
			staleTime: 60_000,
		})),
	});

	const configuredRepos = new Set<string>();
	const options = new Map<
		string,
		{ key: string; repo: string; installationId: number; isConfigured: boolean }
	>();

	connections.forEach((connection) => {
		connection.repositories.forEach((repo) => {
			const normalisedRepo = repo.trim().toLowerCase();
			if (!normalisedRepo) {
				return;
			}
			configuredRepos.add(`${connection.installationId}:${normalisedRepo}`);
			options.set(`${connection.installationId}:${normalisedRepo}`, {
				key: `${connection.installationId}:${normalisedRepo}`,
				repo: normalisedRepo,
				installationId: connection.installationId,
				isConfigured: true,
			});
		});
	});

	results.forEach((result, index) => {
		const connection = connections[index];
		if (!connection || !Array.isArray(result.data)) {
			return;
		}
		result.data.forEach((repo) => {
			const normalisedRepo = repo.trim().toLowerCase();
			if (!normalisedRepo) {
				return;
			}
			const key = `${connection.installationId}:${normalisedRepo}`;
			if (options.has(key)) {
				return;
			}
			options.set(key, {
				key,
				repo: normalisedRepo,
				installationId: connection.installationId,
				isConfigured: configuredRepos.has(key),
			});
		});
	});

	return {
		repoOptions: Array.from(options.values()).sort((a, b) => a.repo.localeCompare(b.repo)),
		isLoading: results.some((result) => result.isLoading),
		error: results.find((result) => result.error)?.error as Error | undefined,
	};
}

export const useUpsertSandboxConnection = () => {
	const queryClient = useQueryClient();
	return useMutation<void, Error, CreateSandboxConnectionInput>({
		mutationFn: (input) => upsertSandboxConnection(input),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: SANDBOX_QUERY_KEYS.connections(),
			});
		},
	});
};

export const useDeleteSandboxConnection = () => {
	const queryClient = useQueryClient();
	return useMutation<void, Error, number>({
		mutationFn: (installationId) => deleteSandboxConnection(installationId),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: SANDBOX_QUERY_KEYS.connections(),
			});
			queryClient.invalidateQueries({
				queryKey: SANDBOX_QUERY_KEYS.root,
			});
		},
	});
};

export const useConnectSandboxInstallation = () => {
	const queryClient = useQueryClient();
	return useMutation<void, Error, ConnectSandboxInstallationInput>({
		mutationFn: (input) => connectSandboxInstallation(input),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: SANDBOX_QUERY_KEYS.connections(),
			});
			queryClient.invalidateQueries({
				queryKey: SANDBOX_QUERY_KEYS.root,
			});
		},
	});
};

export const useUpdateSandboxConnectionRepositories = () => {
	const queryClient = useQueryClient();
	return useMutation<
		void,
		Error,
		{ installationId: number; input: SandboxConnectionRepositoriesPayload }
	>({
		mutationFn: ({ installationId, input }) =>
			updateSandboxConnectionRepositories(installationId, input),
		onSuccess: (_result, variables) => {
			queryClient.invalidateQueries({
				queryKey: SANDBOX_QUERY_KEYS.connections(),
			});
			queryClient.invalidateQueries({
				queryKey: SANDBOX_QUERY_KEYS.connectionRepositories(variables.installationId),
			});
		},
	});
};

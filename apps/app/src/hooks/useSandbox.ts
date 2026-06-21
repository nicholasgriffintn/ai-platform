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
	SandboxInstallConfig,
} from "@assistant/schemas";
import { useCanAccessProFeatures } from "./useCanAccessProFeatures";

export const SANDBOX_QUERY_KEYS = {
	root: ["sandbox"] as const,
	installConfig: () => [...SANDBOX_QUERY_KEYS.root, "install-config"] as const,
	connections: () => [...SANDBOX_QUERY_KEYS.root, "connections"] as const,
	connectionRepositories: (installationId: number) =>
		[...SANDBOX_QUERY_KEYS.root, "connections", installationId, "repositories"] as const,
};

export const useSandboxConnections = () => {
	const canAccessProFeatures = useCanAccessProFeatures();
	const query = useQuery<SandboxConnection[], Error>({
		queryKey: SANDBOX_QUERY_KEYS.connections(),
		queryFn: () => fetchSandboxConnections(),
		enabled: canAccessProFeatures,
	});
	return {
		...query,
		data: canAccessProFeatures ? query.data : undefined,
		error: canAccessProFeatures ? query.error : null,
		isFetching: canAccessProFeatures ? query.isFetching : false,
		isLoading: canAccessProFeatures ? query.isLoading : false,
	};
};

export const useSandboxInstallConfig = () => {
	const canAccessProFeatures = useCanAccessProFeatures();
	const query = useQuery<SandboxInstallConfig, Error>({
		queryKey: SANDBOX_QUERY_KEYS.installConfig(),
		queryFn: () => fetchSandboxInstallConfig(),
		enabled: canAccessProFeatures,
	});
	return {
		...query,
		data: canAccessProFeatures ? query.data : undefined,
		error: canAccessProFeatures ? query.error : null,
		isFetching: canAccessProFeatures ? query.isFetching : false,
		isLoading: canAccessProFeatures ? query.isLoading : false,
	};
};

export const useSandboxConnectionRepositories = (installationId?: number) => {
	const canAccessProFeatures = useCanAccessProFeatures();
	return useQuery({
		queryKey: SANDBOX_QUERY_KEYS.connectionRepositories(installationId ?? 0),
		queryFn: () => fetchSandboxConnectionRepositories(installationId!),
		enabled: canAccessProFeatures && Boolean(installationId),
	});
};

export function useSandboxRepositoryOptions(connections: SandboxConnection[]) {
	const canAccessProFeatures = useCanAccessProFeatures();
	const results = useQueries({
		queries: canAccessProFeatures
			? connections.map((connection) => ({
					queryKey: SANDBOX_QUERY_KEYS.connectionRepositories(connection.installationId),
					queryFn: () => fetchSandboxConnectionRepositories(connection.installationId),
					staleTime: 60_000,
				}))
			: [],
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

	const repositoryError = results.find((result) => result.error)?.error;

	return {
		repoOptions: Array.from(options.values()).sort((a, b) => a.repo.localeCompare(b.repo)),
		isLoading: results.some((result) => result.isLoading),
		error: repositoryError instanceof Error ? repositoryError : undefined,
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

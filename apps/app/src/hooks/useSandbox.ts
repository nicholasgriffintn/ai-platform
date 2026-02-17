import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
	cancelSandboxRun,
	pauseSandboxRun,
	resumeSandboxRun,
	connectSandboxInstallation,
	fetchSandboxInstallConfig,
	deleteSandboxConnection,
	fetchSandboxConnections,
	fetchSandboxRun,
	fetchSandboxRuns,
	upsertSandboxConnection,
} from "~/lib/api/sandbox";
import type {
	ConnectSandboxInstallationInput,
	CreateSandboxConnectionInput,
	SandboxRun,
} from "~/types/sandbox";

export const SANDBOX_QUERY_KEYS = {
	root: ["sandbox"] as const,
	installConfig: () => [...SANDBOX_QUERY_KEYS.root, "install-config"] as const,
	connections: () => [...SANDBOX_QUERY_KEYS.root, "connections"] as const,
	runs: (params: { installationId?: number; repo?: string; limit?: number }) =>
		[
			...SANDBOX_QUERY_KEYS.root,
			"runs",
			params.installationId ?? null,
			params.repo ?? "",
			params.limit ?? null,
		] as const,
	run: (runId?: string) =>
		[...SANDBOX_QUERY_KEYS.root, "run", runId ?? null] as const,
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

export const useSandboxRuns = (
	params: {
		installationId?: number;
		repo?: string;
		limit?: number;
	},
	options?: { enabled?: boolean },
) =>
	useQuery<SandboxRun[], Error>({
		queryKey: SANDBOX_QUERY_KEYS.runs(params),
		queryFn: () => fetchSandboxRuns(params),
		enabled: options?.enabled ?? true,
	});

export const useSandboxRun = (runId?: string) =>
	useQuery<SandboxRun, Error>({
		queryKey: SANDBOX_QUERY_KEYS.run(runId),
		queryFn: () => {
			if (!runId) {
				throw new Error("Run ID is required");
			}
			return fetchSandboxRun(runId);
		},
		enabled: Boolean(runId),
	});

export const useCancelSandboxRun = () => {
	const queryClient = useQueryClient();
	return useMutation<SandboxRun, Error, { runId: string; reason?: string }>({
		mutationFn: ({ runId, reason }) => cancelSandboxRun(runId, reason),
		onSuccess: (_run, variables) => {
			queryClient.invalidateQueries({
				queryKey: SANDBOX_QUERY_KEYS.root,
			});
			queryClient.invalidateQueries({
				queryKey: SANDBOX_QUERY_KEYS.run(variables.runId),
			});
		},
	});
};

export const usePauseSandboxRun = () => {
	const queryClient = useQueryClient();
	return useMutation<SandboxRun, Error, { runId: string; reason?: string }>({
		mutationFn: ({ runId, reason }) => pauseSandboxRun(runId, reason),
		onSuccess: (_run, variables) => {
			queryClient.invalidateQueries({
				queryKey: SANDBOX_QUERY_KEYS.root,
			});
			queryClient.invalidateQueries({
				queryKey: SANDBOX_QUERY_KEYS.run(variables.runId),
			});
		},
	});
};

export const useResumeSandboxRun = () => {
	const queryClient = useQueryClient();
	return useMutation<SandboxRun, Error, { runId: string; reason?: string }>({
		mutationFn: ({ runId, reason }) => resumeSandboxRun(runId, reason),
		onSuccess: (_run, variables) => {
			queryClient.invalidateQueries({
				queryKey: SANDBOX_QUERY_KEYS.root,
			});
			queryClient.invalidateQueries({
				queryKey: SANDBOX_QUERY_KEYS.run(variables.runId),
			});
		},
	});
};

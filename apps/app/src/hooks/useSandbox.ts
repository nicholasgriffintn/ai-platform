import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
	deleteSandboxConnection,
	fetchSandboxConnections,
	fetchSandboxRun,
	fetchSandboxRuns,
	upsertSandboxConnection,
} from "~/lib/api/sandbox";
import type { CreateSandboxConnectionInput, SandboxRun } from "~/types/sandbox";

export const SANDBOX_QUERY_KEYS = {
	root: ["sandbox"] as const,
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

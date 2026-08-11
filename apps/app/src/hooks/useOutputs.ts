import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
	createOutputShare,
	getOutput,
	listOutputs,
	listOutputShares,
	revokeOutputShare,
} from "~/lib/api/outputs";

export const OUTPUT_QUERY_KEYS = {
	all: ["outputs"] as const,
	list: (projectId?: string, capabilityId?: string) =>
		["outputs", "list", projectId, capabilityId] as const,
	detail: (outputId: string | null) => ["outputs", "detail", outputId] as const,
	shares: (outputId: string | null) => ["outputs", "shares", outputId] as const,
};

export function useOutputs(
	projectId?: string,
	capabilityId?: string,
	options?: { enabled?: boolean },
) {
	return useQuery({
		queryKey: OUTPUT_QUERY_KEYS.list(projectId, capabilityId),
		queryFn: () => listOutputs({ projectId, capabilityId }),
		enabled: options?.enabled ?? true,
	});
}

export function useOutput(outputId: string | null) {
	return useQuery({
		queryKey: OUTPUT_QUERY_KEYS.detail(outputId),
		queryFn: () => (outputId ? getOutput(outputId) : Promise.reject(new Error("No output ID"))),
		enabled: Boolean(outputId),
	});
}

export function useOutputShares(outputId: string | null) {
	return useQuery({
		queryKey: OUTPUT_QUERY_KEYS.shares(outputId),
		queryFn: () =>
			outputId ? listOutputShares(outputId) : Promise.reject(new Error("No output ID")),
		enabled: Boolean(outputId),
	});
}

export function useCreateOutputShare() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ outputId, expiresAt }: { outputId: string; expiresAt?: string | null }) =>
			createOutputShare(outputId, expiresAt),
		onSuccess: (_share, variables) =>
			queryClient.invalidateQueries({ queryKey: OUTPUT_QUERY_KEYS.shares(variables.outputId) }),
	});
}

export function useRevokeOutputShare() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ outputId, shareId }: { outputId: string; shareId: string }) =>
			revokeOutputShare(outputId, shareId),
		onSuccess: (_result, variables) =>
			queryClient.invalidateQueries({ queryKey: OUTPUT_QUERY_KEYS.shares(variables.outputId) }),
	});
}

export function useInvalidateOutputs() {
	const queryClient = useQueryClient();
	return (projectId?: string) =>
		queryClient.invalidateQueries({
			queryKey: projectId ? ["outputs", "list", projectId] : OUTPUT_QUERY_KEYS.all,
		});
}

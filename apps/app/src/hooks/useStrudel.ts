import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { strudelService } from "~/lib/api/services/strudel-service";
import type {
	GenerateStrudelRequest,
	GenerateStrudelResponse,
	SaveStrudelPatternInput,
	StrudelPattern,
	UpdateStrudelPatternInput,
} from "~/types";

export const STRUDEL_QUERY_KEYS = {
	root: ["strudel"] as const,
	list: (projectId?: string) => [...STRUDEL_QUERY_KEYS.root, projectId, "patterns"] as const,
	detail: (projectId?: string, id?: string) =>
		[...STRUDEL_QUERY_KEYS.root, projectId, "pattern", id] as const,
};

export const useStrudelPatterns = (projectId?: string, options?: { enabled?: boolean }) =>
	useQuery<StrudelPattern[], Error>({
		queryKey: STRUDEL_QUERY_KEYS.list(projectId),
		queryFn: () => strudelService.list(projectId),
		enabled: options?.enabled ?? true,
	});

export const useStrudelPattern = (id?: string, projectId?: string) =>
	useQuery<StrudelPattern, Error>({
		queryKey: STRUDEL_QUERY_KEYS.detail(projectId, id),
		queryFn: () => {
			if (!id) {
				throw new Error("Pattern ID is required");
			}
			return strudelService.get(id, projectId);
		},
		enabled: Boolean(id),
	});

export const useGenerateStrudelPattern = (projectId?: string) =>
	useMutation<GenerateStrudelResponse, Error, GenerateStrudelRequest>({
		mutationFn: (payload) => strudelService.generate(payload, projectId),
	});

export const useSaveStrudelPattern = (projectId?: string) => {
	const queryClient = useQueryClient();
	return useMutation<StrudelPattern, Error, SaveStrudelPatternInput>({
		mutationFn: (payload) => strudelService.save(payload, projectId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: STRUDEL_QUERY_KEYS.list(projectId) });
		},
	});
};

export const useUpdateStrudelPattern = (id?: string, projectId?: string) => {
	const queryClient = useQueryClient();
	return useMutation<StrudelPattern, Error, UpdateStrudelPatternInput>({
		mutationFn: (payload) => {
			if (!id) {
				throw new Error("Pattern ID is required");
			}
			return strudelService.update(id, payload, projectId);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: STRUDEL_QUERY_KEYS.list(projectId) });
			if (id) {
				queryClient.invalidateQueries({
					queryKey: STRUDEL_QUERY_KEYS.detail(projectId, id),
				});
			}
		},
	});
};

export const useDeleteStrudelPattern = (projectId?: string) => {
	const queryClient = useQueryClient();
	return useMutation<void, Error, string>({
		mutationFn: (patternId) => strudelService.delete(patternId, projectId),
		onSuccess: (_, patternId) => {
			queryClient.invalidateQueries({ queryKey: STRUDEL_QUERY_KEYS.list(projectId) });
			queryClient.invalidateQueries({
				queryKey: STRUDEL_QUERY_KEYS.detail(projectId, patternId),
			});
		},
	});
};

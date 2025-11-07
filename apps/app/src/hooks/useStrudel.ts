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
	list: () => [...STRUDEL_QUERY_KEYS.root, "patterns"] as const,
	detail: (id?: string) => [...STRUDEL_QUERY_KEYS.root, "pattern", id] as const,
};

export const useStrudelPatterns = () =>
	useQuery<StrudelPattern[], Error>({
		queryKey: STRUDEL_QUERY_KEYS.list(),
		queryFn: () => strudelService.list(),
	});

export const useStrudelPattern = (id?: string) =>
	useQuery<StrudelPattern, Error>({
		queryKey: STRUDEL_QUERY_KEYS.detail(id),
		queryFn: () => {
			if (!id) {
				throw new Error("Pattern ID is required");
			}
			return strudelService.get(id);
		},
		enabled: Boolean(id),
	});

export const useGenerateStrudelPattern = () =>
	useMutation<GenerateStrudelResponse, Error, GenerateStrudelRequest>({
		mutationFn: (payload) => strudelService.generate(payload),
	});

export const useSaveStrudelPattern = () => {
	const queryClient = useQueryClient();
	return useMutation<StrudelPattern, Error, SaveStrudelPatternInput>({
		mutationFn: (payload) => strudelService.save(payload),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: STRUDEL_QUERY_KEYS.list() });
		},
	});
};

export const useUpdateStrudelPattern = (id?: string) => {
	const queryClient = useQueryClient();
	return useMutation<StrudelPattern, Error, UpdateStrudelPatternInput>({
		mutationFn: (payload) => {
			if (!id) {
				throw new Error("Pattern ID is required");
			}
			return strudelService.update(id, payload);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: STRUDEL_QUERY_KEYS.list() });
			if (id) {
				queryClient.invalidateQueries({
					queryKey: STRUDEL_QUERY_KEYS.detail(id),
				});
			}
		},
	});
};

export const useDeleteStrudelPattern = () => {
	const queryClient = useQueryClient();
	return useMutation<void, Error, string>({
		mutationFn: (patternId) => strudelService.delete(patternId),
		onSuccess: (_, patternId) => {
			queryClient.invalidateQueries({ queryKey: STRUDEL_QUERY_KEYS.list() });
			queryClient.invalidateQueries({
				queryKey: STRUDEL_QUERY_KEYS.detail(patternId),
			});
		},
	});
};

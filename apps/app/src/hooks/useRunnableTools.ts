import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { executeRunnableTool, fetchRunnableTool } from "~/lib/api/runnable-tools";
import { OUTPUT_QUERY_KEYS } from "~/hooks/useOutputs";

export const RUNNABLE_TOOL_QUERY_KEYS = {
	byId: (id: string | null) => ["runnableTool", id],
};

export function useRunnableTool(id: string | null) {
	return useQuery({
		queryKey: RUNNABLE_TOOL_QUERY_KEYS.byId(id),
		queryFn: () => fetchRunnableTool(id as string),
		enabled: Boolean(id),
		// An output's capability may be an experience rather than a tool, so a miss is expected.
		retry: false,
		staleTime: 30 * 60 * 1000,
		gcTime: 60 * 60 * 1000,
	});
}

export function useExecuteRunnableTool() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			id,
			formData,
			projectId,
		}: {
			id: string;
			formData: Record<string, any>;
			projectId?: string;
		}) => executeRunnableTool(id, formData, projectId),
		onSuccess: (_, { projectId }) => {
			queryClient.invalidateQueries({
				queryKey: projectId ? OUTPUT_QUERY_KEYS.listsByProject(projectId) : OUTPUT_QUERY_KEYS.all,
			});
		},
	});
}

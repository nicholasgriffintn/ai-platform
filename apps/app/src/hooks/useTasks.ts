import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { taskService } from "~/lib/api/task-service";
import type {
	Task,
	CreateTaskResponse,
	TriggerMemorySynthesisRequest,
	MemorySynthesis,
} from "@assistant/schemas";

export const TASK_QUERY_KEYS = {
	tasks: ["tasks"],
	task: (taskId: string) => ["tasks", taskId],
	synthesis: (namespace?: string) => ["memory-synthesis", namespace ?? "global"],
	synthesisHistory: (namespace?: string) => [
		"memory-synthesis-history",
		namespace ?? "global",
	],
};

interface ListTasksResponse {
	tasks: Task[];
	total: number;
}

interface MemorySynthesisHistoryResponse {
	syntheses: MemorySynthesis[];
	total: number;
}

interface GetMemorySynthesisResponse {
	synthesis?: MemorySynthesis;
}

export function useTasks() {
	const queryClient = useQueryClient();

	// Fetch all tasks
	const { data: tasksData, isLoading: isLoadingTasks } =
		useQuery<ListTasksResponse>({
			queryKey: TASK_QUERY_KEYS.tasks,
			queryFn: () => taskService.listTasks(),
			staleTime: 1000 * 10, // 10 seconds - tasks change frequently
			refetchInterval: 1000 * 30, // Auto-refetch every 30 seconds for status updates
		});

	// Trigger memory synthesis mutation
	const triggerSynthesisMutation = useMutation<
		CreateTaskResponse,
		Error,
		TriggerMemorySynthesisRequest | undefined
	>({
		mutationFn: async (data) => {
			return await taskService.triggerMemorySynthesis(data);
		},
		onSuccess: () => {
			// Invalidate tasks to show the new synthesis task
			queryClient.invalidateQueries({ queryKey: TASK_QUERY_KEYS.tasks });
		},
	});

	// Cancel task mutation
	const cancelTaskMutation = useMutation<{ success: boolean }, Error, string>({
		mutationFn: async (taskId: string) => {
			return await taskService.cancelTask(taskId);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: TASK_QUERY_KEYS.tasks });
		},
	});

	return {
		tasks: tasksData?.tasks || [],
		totalTasks: tasksData?.total || 0,
		isLoadingTasks,

		triggerSynthesis: triggerSynthesisMutation.mutate,
		isTriggeringSynthesis: triggerSynthesisMutation.isPending,

		cancelTask: cancelTaskMutation.mutate,
		isCancellingTask: cancelTaskMutation.isPending,
	};
}

export function useMemorySynthesis(namespace = "global") {
	const queryClient = useQueryClient();

	// Fetch active synthesis
	const { data: synthesisData, isLoading: isLoadingSynthesis } =
		useQuery<GetMemorySynthesisResponse>({
			queryKey: TASK_QUERY_KEYS.synthesis(namespace),
			queryFn: () => taskService.getActiveSynthesis(namespace),
			staleTime: 1000 * 60 * 5, // 5 minutes
		});

	// Fetch synthesis history
	const { data: historyData, isLoading: isLoadingHistory } =
		useQuery<MemorySynthesisHistoryResponse>({
			queryKey: TASK_QUERY_KEYS.synthesisHistory(namespace),
			queryFn: () => taskService.getSynthesisHistory(namespace, 10),
			staleTime: 1000 * 60 * 5, // 5 minutes
		});

	return {
		synthesis: synthesisData?.synthesis,
		isLoadingSynthesis,

		history: historyData?.syntheses || [],
		historyTotal: historyData?.total || 0,
		isLoadingHistory,

		refresh: () => {
			queryClient.invalidateQueries({
				queryKey: TASK_QUERY_KEYS.synthesis(namespace),
			});
			queryClient.invalidateQueries({
				queryKey: TASK_QUERY_KEYS.synthesisHistory(namespace),
			});
		},
	};
}

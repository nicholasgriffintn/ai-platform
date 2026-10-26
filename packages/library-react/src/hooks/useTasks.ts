import { taskService } from "@ngriffin_uk/polychat-library-client";
import type {
  CreateTaskResponse,
  GetMemorySynthesisResponse,
  ListPage,
  ListTasksResponse,
  MemorySynthesis,
  TriggerMemorySynthesisRequest,
} from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { liveOrPoll } from "../sync/live-or-poll.js";

export const TASK_QUERY_KEYS = {
  tasks: ["tasks"],
  task: (taskId: string) => ["tasks", taskId],
  synthesis: () => ["memory-synthesis"],
  synthesisHistory: () => ["memory-synthesis-history"],
};

const ACTIVE_TASK_STATUSES = new Set(["pending", "queued", "running"]);

export function useTasks({ shouldRefetch = true }) {
  const queryClient = useQueryClient();

  const {
    data: tasksData,
    isLoading: isLoadingTasks,
    error: tasksError,
  } = useQuery<ListTasksResponse>({
    queryKey: TASK_QUERY_KEYS.tasks,
    queryFn: () => taskService.listTasks(),
    staleTime: 1000 * 10, // 10 seconds
    refetchInterval: (query) =>
      liveOrPoll(
        query,
        (currentQuery) => {
          if (!shouldRefetch) {
            return false;
          }

          const data = currentQuery.state.data;

          if (!data) {
            return false;
          }

          const hasActiveTasks = data.data.some((task) =>
            ACTIVE_TASK_STATUSES.has(String(task.status)),
          );

          return hasActiveTasks ? 1000 * 30 : false;
        },
        "task.changed",
      ),
  });

  const triggerSynthesisMutation = useMutation<
    CreateTaskResponse,
    Error,
    TriggerMemorySynthesisRequest | undefined
  >({
    mutationFn: async (data) => {
      return await taskService.triggerMemorySynthesis(data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: TASK_QUERY_KEYS.tasks });
    },
  });

  const cancelTaskMutation = useMutation<{ success: boolean }, Error, string>({
    mutationFn: async (taskId: string) => {
      return await taskService.cancelTask(taskId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: TASK_QUERY_KEYS.tasks });
    },
  });

  return {
    tasks: tasksData?.data ?? [],
    isLoadingTasks,
    tasksError,

    triggerSynthesis: triggerSynthesisMutation.mutate,
    triggerSynthesisAsync: triggerSynthesisMutation.mutateAsync,
    isTriggeringSynthesis: triggerSynthesisMutation.isPending,

    cancelTask: cancelTaskMutation.mutate,
    isCancellingTask: cancelTaskMutation.isPending,
  };
}

export function useMemorySynthesis() {
  const queryClient = useQueryClient();

  const { data: synthesisData, isLoading: isLoadingSynthesis } =
    useQuery<GetMemorySynthesisResponse>({
      queryKey: TASK_QUERY_KEYS.synthesis(),
      queryFn: () => taskService.getActiveSynthesis(),
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchInterval: (query) => liveOrPoll(query, 1000 * 30, "task.changed"),
    });

  const { data: historyData, isLoading: isLoadingHistory } = useQuery<ListPage<MemorySynthesis>>({
    queryKey: TASK_QUERY_KEYS.synthesisHistory(),
    queryFn: () => taskService.getSynthesisHistory(10),
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchInterval: (query) => liveOrPoll(query, 1000 * 30, "task.changed"),
  });

  return {
    synthesis: synthesisData?.synthesis,
    isLoadingSynthesis,

    history: historyData?.data ?? [],
    isLoadingHistory,

    refresh: () => {
      void queryClient.invalidateQueries({
        queryKey: TASK_QUERY_KEYS.synthesis(),
      });
      void queryClient.invalidateQueries({
        queryKey: TASK_QUERY_KEYS.synthesisHistory(),
      });
    },
  };
}

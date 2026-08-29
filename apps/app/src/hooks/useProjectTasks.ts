import type {
  CreateProjectTaskInput,
  ProjectTask,
  UpdateProjectTaskInput,
} from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  acceptProjectTask,
  createProjectTask,
  deleteProjectTask,
  listProjectTasks,
  listTaskAttention,
  startProjectTask,
  updateProjectTask,
} from "~/lib/api/project-tasks";
import { useChatStore } from "~/state/stores/chatStore";

export const projectTasksQueryKey = (projectId: string) => ["project-tasks", projectId] as const;
export const TASK_ATTENTION_QUERY_KEY = ["task-attention"] as const;

const IDLE_REFETCH_MS = 60_000;
const ACTIVE_REFETCH_MS = 5_000;

function hasWorkInFlight(tasks: ProjectTask[] | undefined): boolean {
  return Boolean(tasks?.some((task) => task.status === "running" || task.status === "queued"));
}

export function useProjectTasks(projectId: string) {
  const queryClient = useQueryClient();
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const isPro = useChatStore((state) => state.isPro);

  const query = useQuery({
    queryKey: projectTasksQueryKey(projectId),
    queryFn: () => listProjectTasks(projectId),
    enabled: Boolean(projectId) && isAuthenticated && isPro,
    refetchInterval: (currentQuery) =>
      hasWorkInFlight(currentQuery.state.data?.tasks) ? ACTIVE_REFETCH_MS : IDLE_REFETCH_MS,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: projectTasksQueryKey(projectId),
    });
    void queryClient.invalidateQueries({ queryKey: TASK_ATTENTION_QUERY_KEY });
  };

  const create = useMutation({
    mutationFn: (input: CreateProjectTaskInput) => createProjectTask(projectId, input),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ taskId, input }: { taskId: string; input: UpdateProjectTaskInput }) =>
      updateProjectTask(projectId, taskId, input),
    onSuccess: invalidate,
  });

  const start = useMutation({
    mutationFn: (taskId: string) => startProjectTask(projectId, taskId),
    onSuccess: invalidate,
  });

  const accept = useMutation({
    mutationFn: (taskId: string) => acceptProjectTask(projectId, taskId),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (taskId: string) => deleteProjectTask(projectId, taskId),
    onSuccess: invalidate,
  });

  return {
    tasks: query.data?.tasks ?? [],
    flow: query.data?.flow ?? null,
    isLoading: query.isLoading,
    error: query.error,
    create,
    update,
    start,
    accept,
    remove,
  };
}

export function useTaskAttention() {
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const isPro = useChatStore((state) => state.isPro);

  const query = useQuery({
    queryKey: TASK_ATTENTION_QUERY_KEY,
    queryFn: listTaskAttention,
    enabled: isAuthenticated && isPro,
    staleTime: 30_000,
  });

  return {
    items: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
  };
}

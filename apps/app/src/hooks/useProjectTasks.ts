import type {
  AnswerUserQuestionsInput,
  CreateProjectTaskInput,
  ProjectFlow,
  ProjectTask,
  ResolveProjectTaskToolApprovalInput,
  UpdateProjectTaskInput,
} from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  acceptProjectTask,
  answerProjectTaskQuestions,
  createProjectTask,
  deleteProjectTask,
  getProjectTask,
  listProjectTasks,
  listTaskAttention,
  resolveProjectTaskToolApproval,
  startProjectTask,
  setProjectFlow,
  updateProjectTask,
} from "~/lib/api/project-tasks";
import { useChatStore } from "~/state/stores/chatStore";

export const projectTasksQueryKey = (projectId: string) => ["project-tasks", projectId] as const;
export const TASK_ATTENTION_QUERY_KEY = ["task-attention"] as const;
export const projectTaskDetailQueryKey = (projectId: string, taskId: string) =>
  ["project-task", projectId, taskId] as const;

const IDLE_REFETCH_MS = 30_000;
const ACTIVE_REFETCH_MS = 2_000;

function hasWorkInFlight(tasks: readonly Pick<ProjectTask, "status">[] | undefined): boolean {
  return Boolean(tasks?.some((task) => task.status === "running" || task.status === "queued"));
}

export function projectTasksRefetchInterval(
  tasks: readonly Pick<ProjectTask, "status">[] | undefined,
): number {
  return hasWorkInFlight(tasks) ? ACTIVE_REFETCH_MS : IDLE_REFETCH_MS;
}

export function useProjectTask(projectId: string, taskId: string) {
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const isPro = useChatStore((state) => state.isPro);

  return useQuery({
    queryKey: projectTaskDetailQueryKey(projectId, taskId),
    queryFn: () => getProjectTask(projectId, taskId),
    enabled: Boolean(projectId && taskId) && isAuthenticated && isPro,
    refetchInterval: (currentQuery) =>
      projectTasksRefetchInterval(
        currentQuery.state.data ? [currentQuery.state.data.task] : undefined,
      ),
    refetchIntervalInBackground: true,
  });
}

export function useProjectTasks(projectId: string) {
  const queryClient = useQueryClient();
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const isPro = useChatStore((state) => state.isPro);

  const query = useQuery({
    queryKey: projectTasksQueryKey(projectId),
    queryFn: () => listProjectTasks(projectId),
    enabled: Boolean(projectId) && isAuthenticated && isPro,
    refetchInterval: (currentQuery) => projectTasksRefetchInterval(currentQuery.state.data?.tasks),
    refetchIntervalInBackground: true,
  });

  const writeTask = (task: ProjectTask) => {
    queryClient.setQueryData<{ tasks: ProjectTask[]; flow: ProjectFlow | null }>(
      projectTasksQueryKey(projectId),
      (current) => {
        if (!current) {
          return current;
        }

        const exists = current.tasks.some((candidate) => candidate.id === task.id);

        return {
          ...current,
          tasks: exists
            ? current.tasks.map((candidate) => (candidate.id === task.id ? task : candidate))
            : [task, ...current.tasks],
        };
      },
    );
    queryClient.setQueryData(projectTaskDetailQueryKey(projectId, task.id), (current: unknown) =>
      current && typeof current === "object" ? { ...current, task } : current,
    );

    if (task.conversationId) {
      void queryClient.invalidateQueries({ queryKey: ["goal", task.conversationId] });
    }
  };

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: projectTasksQueryKey(projectId),
    });
    void queryClient.invalidateQueries({ queryKey: TASK_ATTENTION_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: ["project-task", projectId] });
  };

  const create = useMutation({
    mutationFn: (input: CreateProjectTaskInput) => createProjectTask(projectId, input),
    onSuccess: ({ task }) => {
      writeTask(task);
      invalidate();
    },
  });

  const update = useMutation({
    mutationFn: ({ taskId, input }: { taskId: string; input: UpdateProjectTaskInput }) =>
      updateProjectTask(projectId, taskId, input),
    onSuccess: ({ task }) => {
      writeTask(task);
      invalidate();
    },
  });

  const start = useMutation({
    mutationFn: (taskId: string) => startProjectTask(projectId, taskId),
    onSuccess: ({ task }) => {
      writeTask(task);
      invalidate();
    },
  });

  const accept = useMutation({
    mutationFn: (taskId: string) => acceptProjectTask(projectId, taskId),
    onSuccess: ({ task }) => {
      writeTask(task);
      invalidate();
    },
  });

  const answer = useMutation({
    mutationFn: ({ taskId, input }: { taskId: string; input: AnswerUserQuestionsInput }) =>
      answerProjectTaskQuestions(projectId, taskId, input),
    onSuccess: ({ task }) => {
      writeTask(task);
      invalidate();
    },
  });

  const approval = useMutation({
    mutationFn: ({
      taskId,
      input,
    }: {
      taskId: string;
      input: ResolveProjectTaskToolApprovalInput;
    }) => resolveProjectTaskToolApproval(projectId, taskId, input),
    onSuccess: ({ task }) => {
      writeTask(task);
      invalidate();
    },
  });

  const remove = useMutation({
    mutationFn: (taskId: string) => deleteProjectTask(projectId, taskId),
    onSuccess: (_result, taskId) => {
      queryClient.setQueryData<{ tasks: ProjectTask[]; flow: ProjectFlow | null }>(
        projectTasksQueryKey(projectId),
        (current) =>
          current
            ? { ...current, tasks: current.tasks.filter((task) => task.id !== taskId) }
            : current,
      );
      queryClient.removeQueries({ queryKey: projectTaskDetailQueryKey(projectId, taskId) });
      invalidate();
    },
  });

  const saveFlow = useMutation({
    mutationFn: (flow: ProjectFlow) => setProjectFlow(projectId, flow),
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
    answer,
    approval,
    remove,
    saveFlow,
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

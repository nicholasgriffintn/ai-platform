import type { CreateLeanProofProjectTaskInput, ProjectTask } from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";

import { createLeanProof, getLeanProof, listLeanProofs } from "~/lib/api/lean-proofs";
import { acceptProjectTask, startProjectTask } from "~/lib/api/project-tasks";
import { fingerprintLeanProofRequest } from "~/lib/lean-proof-request";
import { useChatStore } from "~/state/stores/chatStore";

import { OUTPUT_QUERY_KEYS } from "./useOutputs";
import { projectTaskDetailQueryKey, projectTasksQueryKey } from "./useProjectTasks";

export const leanProofsQueryKey = (projectId: string) => ["lean-proofs", projectId] as const;
export const leanProofDetailQueryKey = (projectId: string, taskId: string) =>
  ["lean-proofs", projectId, taskId] as const;

const ACTIVE_REFETCH_MS = 2_000;

export function leanProofRefetchInterval(task?: Pick<ProjectTask, "status">): number | false {
  return task?.status === "queued" || task?.status === "running" ? ACTIVE_REFETCH_MS : false;
}

export function useLeanProofs(projectId: string) {
  const queryClient = useQueryClient();
  const pendingCreate = useRef<{ fingerprint: string; idempotencyKey: string } | null>(null);
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const isPro = useChatStore((state) => state.isPro);
  const enabled = Boolean(projectId) && isAuthenticated && isPro;

  const query = useQuery({
    queryKey: leanProofsQueryKey(projectId),
    queryFn: () => listLeanProofs(projectId),
    enabled,
    refetchInterval: (currentQuery) =>
      currentQuery.state.data?.tasks.some(
        (task) => task.status === "queued" || task.status === "running",
      )
        ? ACTIVE_REFETCH_MS
        : false,
  });

  const invalidateRelated = (taskId?: string) => {
    void queryClient.invalidateQueries({ queryKey: leanProofsQueryKey(projectId) });
    void queryClient.invalidateQueries({ queryKey: projectTasksQueryKey(projectId) });
    void queryClient.invalidateQueries({ queryKey: OUTPUT_QUERY_KEYS.listsByProject(projectId) });
    if (taskId) {
      void queryClient.invalidateQueries({ queryKey: leanProofDetailQueryKey(projectId, taskId) });
      void queryClient.invalidateQueries({
        queryKey: projectTaskDetailQueryKey(projectId, taskId),
      });
    }
  };

  const create = useMutation({
    mutationFn: (input: CreateLeanProofProjectTaskInput) => {
      const fingerprint = fingerprintLeanProofRequest(input);

      if (pendingCreate.current?.fingerprint !== fingerprint) {
        pendingCreate.current = { fingerprint, idempotencyKey: crypto.randomUUID() };
      }

      return createLeanProof(projectId, input, pendingCreate.current.idempotencyKey);
    },
    onSuccess: ({ task }) => {
      pendingCreate.current = null;
      invalidateRelated(task.id);
    },
  });

  const retry = useMutation({
    mutationFn: (taskId: string) => startProjectTask(projectId, taskId),
    onSuccess: ({ task }) => invalidateRelated(task.id),
  });

  const approve = useMutation({
    mutationFn: (taskId: string) => acceptProjectTask(projectId, taskId),
    onSuccess: ({ task }) => invalidateRelated(task.id),
  });

  return {
    tasks: query.data?.tasks ?? [],
    isLoading: query.isLoading,
    error: query.error,
    create,
    retry,
    approve,
  };
}

export function useLeanProof(projectId: string, taskId: string) {
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const isPro = useChatStore((state) => state.isPro);

  return useQuery({
    queryKey: leanProofDetailQueryKey(projectId, taskId),
    queryFn: () => getLeanProof(projectId, taskId),
    enabled: Boolean(projectId && taskId) && isAuthenticated && isPro,
    refetchInterval: (currentQuery) => leanProofRefetchInterval(currentQuery.state.data?.task),
    refetchIntervalInBackground: true,
  });
}

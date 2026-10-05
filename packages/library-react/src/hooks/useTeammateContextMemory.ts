import { apiService } from "@ngriffin_uk/polychat-library-client";
import type { MemoryDocument } from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { liveOrPoll } from "../sync/live-or-poll.js";
import type { SaveMemoryDocumentRevisionInput } from "./useMemoryDocumentEditor.js";

export const teammateContextMemoryQueryKey = (contextId: string) =>
  ["teammate-context-memory", contextId] as const;

export const teammateMemoryMaintenanceQueryPrefix = ["teammate-memory-maintenance"] as const;
export const teammateMemoryMaintenanceQueryKey = (contextId: string) =>
  [...teammateMemoryMaintenanceQueryPrefix, contextId] as const;

export function useTeammateContextMemory(contextId: string) {
  const queryClient = useQueryClient();
  const settledTask = useRef<string | null>(null);
  const maintenance = useQuery({
    queryKey: teammateMemoryMaintenanceQueryKey(contextId),
    queryFn: () => apiService.getTeammateMemoryMaintenance(contextId),
    enabled: Boolean(contextId),
    refetchInterval: (current) =>
      liveOrPoll(
        current,
        current.state.data?.status === "queued" || current.state.data?.status === "running"
          ? 2000
          : 30000,
        "task.changed",
      ),
  });
  const maintain = useMutation({
    mutationFn: () => apiService.requestTeammateMemoryMaintenance(contextId),
    onSuccess: (status) => {
      queryClient.setQueryData(teammateMemoryMaintenanceQueryKey(contextId), status);
      void queryClient.invalidateQueries({
        queryKey: teammateMemoryMaintenanceQueryKey(contextId),
      });
    },
  });

  useEffect(() => {
    const taskId = maintenance.data?.taskId;
    const status = maintenance.data?.status;
    const key = `${contextId}:${taskId}`;

    if (
      (status !== "completed" && status !== "failed" && status !== "cancelled") ||
      !taskId ||
      settledTask.current === key
    ) {
      return;
    }

    settledTask.current = key;
    void queryClient.invalidateQueries({ queryKey: teammateContextMemoryQueryKey(contextId) });
  }, [contextId, maintenance.data?.status, maintenance.data?.taskId, queryClient]);
  const query = useQuery({
    queryKey: teammateContextMemoryQueryKey(contextId),
    queryFn: () => apiService.getTeammateContextMemory(contextId),
    enabled: Boolean(contextId),
  });
  const update = useMutation<MemoryDocument, Error, SaveMemoryDocumentRevisionInput>({
    mutationFn: (input) => apiService.updateTeammateContextMemory(contextId, input),
    onSuccess: (document) => {
      queryClient.setQueryData(teammateContextMemoryQueryKey(contextId), document);
    },
  });

  return { ...query, update, maintenance, maintain };
}

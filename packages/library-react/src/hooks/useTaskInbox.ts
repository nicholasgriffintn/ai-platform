import {
  listTaskInbox,
  updateTaskInboxReceipts,
  useChatStore,
} from "@ngriffin_uk/polychat-library-client";
import type { ProjectTaskAttentionResponse } from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const TASK_INBOX_QUERY_KEY = ["task-inbox"] as const;

export interface TaskInboxOptions {
  refetchIntervalMs?: number;
}

export function useTaskInbox(options: TaskInboxOptions = {}) {
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const queryClient = useQueryClient();

  const inbox = useQuery<ProjectTaskAttentionResponse>({
    queryKey: TASK_INBOX_QUERY_KEY,
    queryFn: () => listTaskInbox(),
    enabled: isAuthenticated,
    staleTime: 15_000,
    refetchInterval: options.refetchIntervalMs ?? false,
    refetchIntervalInBackground: options.refetchIntervalMs !== undefined,
  });

  const receipts = useMutation({
    mutationFn: ({ itemIds, action }: { itemIds: string[]; action: "read" | "dismiss" }) =>
      updateTaskInboxReceipts(itemIds, action),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TASK_INBOX_QUERY_KEY }),
  });

  return {
    items: inbox.data?.items ?? [],
    unread: inbox.data?.unread ?? 0,
    total: inbox.data?.total ?? 0,
    isLoading: inbox.isLoading,
    error: inbox.error,
    refresh: inbox.refetch,
    markRead: (itemIds: string[]) => receipts.mutateAsync({ itemIds, action: "read" }),
    dismiss: (itemIds: string[]) => receipts.mutateAsync({ itemIds, action: "dismiss" }),
    isUpdating: receipts.isPending,
  };
}

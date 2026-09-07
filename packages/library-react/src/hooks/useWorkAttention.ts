import { listWorkAttention, useChatStore } from "@ngriffin_uk/polychat-library-client";
import type { WorkAttentionQuery } from "@ngriffin_uk/polychat-schemas";
import { useQuery } from "@tanstack/react-query";

export interface WorkAttentionOptions {
  /** Poll at this interval, including while the host window is out of view. */
  refetchIntervalMs?: number;
}

export function useWorkAttention(query: WorkAttentionQuery, options: WorkAttentionOptions = {}) {
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const isPro = useChatStore((state) => state.isPro);

  return useQuery({
    queryKey: ["work-attention", query],
    queryFn: () => listWorkAttention(query),
    enabled: isAuthenticated && isPro,
    staleTime: 15_000,
    refetchInterval: options.refetchIntervalMs ?? false,
    refetchIntervalInBackground: options.refetchIntervalMs !== undefined,
  });
}

import { useChatStore } from "@ngriffin_uk/polychat-library-react";
import type { WorkAttentionQuery } from "@ngriffin_uk/polychat-schemas";
import { useQuery } from "@tanstack/react-query";

import { listWorkAttention } from "~/lib/api/attention";

export function useWorkAttention(query: WorkAttentionQuery) {
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const isPro = useChatStore((state) => state.isPro);

  return useQuery({
    queryKey: ["work-attention", query],
    queryFn: () => listWorkAttention(query),
    enabled: isAuthenticated && isPro,
    staleTime: 15_000,
  });
}

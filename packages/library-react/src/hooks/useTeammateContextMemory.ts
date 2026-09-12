import { apiService } from "@ngriffin_uk/polychat-library-client";
import type { MemoryDocument } from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { SaveMemoryDocumentRevisionInput } from "./useMemoryDocumentEditor.js";

export const teammateContextMemoryQueryKey = (contextId: string) =>
  ["teammate-context-memory", contextId] as const;

export function useTeammateContextMemory(contextId: string) {
  const queryClient = useQueryClient();
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

  return { ...query, update };
}

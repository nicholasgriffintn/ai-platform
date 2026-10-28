import { getModelChoices, updateModelChoices } from "@ngriffin_uk/polychat-library-client";
import type { UpdateSystemModelChoicesInput } from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { MODELS_QUERY_KEY } from "./useModels.js";

export function modelChoicesQueryKey(workspaceId?: string) {
  return [MODELS_QUERY_KEY, "choices", workspaceId ?? "personal"] as const;
}

export function useModelChoices(workspaceId?: string) {
  return useQuery({
    queryKey: modelChoicesQueryKey(workspaceId),
    queryFn: () => getModelChoices(workspaceId),
    staleTime: 1000 * 30,
  });
}

export function useUpdateModelChoices(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Omit<UpdateSystemModelChoicesInput, "workspace_id">) =>
      updateModelChoices({ ...input, ...(workspaceId ? { workspace_id: workspaceId } : {}) }),
    onSuccess: (response) => {
      queryClient.setQueryData(modelChoicesQueryKey(workspaceId), response);
    },
  });
}

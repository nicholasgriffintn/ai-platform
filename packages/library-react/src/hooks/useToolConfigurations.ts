import {
  fetchToolConfigurations,
  saveToolConfiguration,
  useChatStore,
} from "@ngriffin_uk/polychat-library-client";
import type {
  ModelToolConfiguration,
  ModelToolId,
  SavedToolConfiguration,
} from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const TOOL_CONFIGURATIONS_QUERY_KEY = ["toolConfigurations"];

export function useToolConfigurations() {
  const queryClient = useQueryClient();
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const query = useQuery({
    queryKey: TOOL_CONFIGURATIONS_QUERY_KEY,
    queryFn: fetchToolConfigurations,
    enabled: isAuthenticated,
  });
  const save = useMutation({
    mutationFn: ({
      toolId,
      configuration,
    }: {
      toolId: ModelToolId;
      configuration: ModelToolConfiguration;
    }) => saveToolConfiguration(toolId, { configuration }),
    onSuccess: (saved) => {
      queryClient.setQueryData<SavedToolConfiguration[]>(
        TOOL_CONFIGURATIONS_QUERY_KEY,
        (current) => [
          ...(current ?? []).filter((configuration) => configuration.toolId !== saved.toolId),
          saved,
        ],
      );
    },
  });

  return { query, save };
}

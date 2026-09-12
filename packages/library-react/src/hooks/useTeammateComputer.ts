import { apiService } from "@ngriffin_uk/polychat-library-client";
import type { TeammateComputer, TeammateComputerAction } from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const teammateComputerQueryKey = (contextId: string) =>
  ["teammate-computer", contextId] as const;

export function useTeammateComputer(contextId: string | undefined) {
  const queryClient = useQueryClient();
  const setComputer = (computer: TeammateComputer) =>
    queryClient.setQueryData(teammateComputerQueryKey(computer.contextId), computer);
  const query = useQuery({
    queryKey: teammateComputerQueryKey(contextId ?? ""),
    queryFn: () => apiService.getTeammateComputer(contextId ?? ""),
    enabled: Boolean(contextId),
  });
  const action = useMutation({
    mutationFn: (input: TeammateComputerAction) =>
      apiService.performTeammateComputerAction(contextId ?? "", input),
    onSuccess: ({ computer }) => setComputer(computer),
  });
  const takeover = useMutation({
    mutationFn: (recordTeaching: boolean | undefined) =>
      apiService.takeOverTeammateComputer(contextId ?? "", recordTeaching ?? false),
    onSuccess: ({ computer }) => setComputer(computer),
  });
  const release = useMutation({
    mutationFn: (fence: number) => apiService.releaseTeammateComputer(contextId ?? "", fence),
    onSuccess: setComputer,
  });

  return { ...query, action, takeover, release };
}

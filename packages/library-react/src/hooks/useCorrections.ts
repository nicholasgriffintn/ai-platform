import {
  dismissCorrection,
  listCorrections,
  useChatStore,
} from "@ngriffin_uk/polychat-library-client";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const CORRECTIONS_QUERY_KEY = ["memory-corrections"] as const;

export function useCorrections() {
  const queryClient = useQueryClient();
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const query = useQuery({
    queryKey: CORRECTIONS_QUERY_KEY,
    queryFn: listCorrections,
    enabled: isAuthenticated,
    staleTime: 1000 * 30,
  });
  const dismiss = useMutation({
    mutationFn: dismissCorrection,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CORRECTIONS_QUERY_KEY }),
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, "Could not forget that rule"));
    },
  });

  return {
    corrections: query.data ?? [],
    isLoading: query.isLoading,
    dismiss: (correctionId: string) => dismiss.mutate(correctionId),
    dismissingId: dismiss.isPending ? dismiss.variables : undefined,
  };
}

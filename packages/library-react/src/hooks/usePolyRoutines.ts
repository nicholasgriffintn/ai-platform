import { apiService } from "@ngriffin_uk/polychat-library-client";
import type { PolyRoutineTemplateId, SetupPolyRoutine } from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const POLY_ROUTINES_QUERY_KEY = ["poly-routines"] as const;

const ROUTINES_POLL_MS = 5 * 60_000;

export function usePolyRoutines(enabled: boolean) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: POLY_ROUTINES_QUERY_KEY });
  const query = useQuery({
    queryKey: POLY_ROUTINES_QUERY_KEY,
    queryFn: () => apiService.readPolyRoutines(),
    enabled,
    refetchInterval: ROUTINES_POLL_MS,
  });
  const setup = useMutation({
    mutationFn: (input: SetupPolyRoutine) => apiService.setupPolyRoutine(input),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (templateId: PolyRoutineTemplateId) => apiService.removePolyRoutine(templateId),
    onSuccess: refresh,
  });

  return { ...query, setup, remove };
}

import { apiService } from "@ngriffin_uk/polychat-library-client";
import { useQuery } from "@tanstack/react-query";

export const POLY_HOME_QUERY_KEY = ["poly-home"] as const;

export function usePolyHome(enabled: boolean) {
  return useQuery({
    queryKey: POLY_HOME_QUERY_KEY,
    queryFn: () => apiService.openPolyHome(),
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

import { apiService } from "@ngriffin_uk/polychat-library-client";
import type { DeviceAuthorisationDecision } from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery } from "@tanstack/react-query";

export function useDeviceAuthorisation(userCode: string | null) {
  return useQuery({
    queryKey: ["device-authorisation", userCode],
    queryFn: () => apiService.getDeviceAuthorisation(userCode ?? ""),
    enabled: Boolean(userCode),
    retry: false,
    staleTime: 0,
  });
}

export function useDecideDeviceAuthorisation(userCode: string | null) {
  return useMutation({
    mutationFn: (decision: DeviceAuthorisationDecision["decision"]) => {
      if (!userCode) {
        throw new Error("Enter the code shown on your device first");
      }

      return apiService.decideDeviceAuthorisation(userCode, decision);
    },
  });
}

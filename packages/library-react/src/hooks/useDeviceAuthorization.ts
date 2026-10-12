import { apiService } from "@ngriffin_uk/polychat-library-client";
import type { DeviceAuthorizationDecision } from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery } from "@tanstack/react-query";

export function useDeviceAuthorization(userCode: string | null) {
  return useQuery({
    queryKey: ["device-authorization", userCode],
    queryFn: () => apiService.getDeviceAuthorization(userCode ?? ""),
    enabled: Boolean(userCode),
    retry: false,
    staleTime: 0,
  });
}

export function useDecideDeviceAuthorization(userCode: string | null) {
  return useMutation({
    mutationFn: (decision: DeviceAuthorizationDecision["decision"]) => {
      if (!userCode) {
        throw new Error("Enter the code shown on your device first");
      }

      return apiService.decideDeviceAuthorization(userCode, decision);
    },
  });
}

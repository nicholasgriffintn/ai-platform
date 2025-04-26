import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiService } from "~/lib/api/api-service";

export function useSubscription() {
  return useQuery<any | null, Error>({
    queryKey: ["subscription"],
    queryFn: () => apiService.getSubscription(),
  });
}

interface CheckoutVars {
  planId: string;
  successUrl: string;
  cancelUrl: string;
}

export function useCreateCheckoutSession() {
  return useMutation<{ url: string }, Error, CheckoutVars>({
    mutationFn: ({ planId, successUrl, cancelUrl }) =>
      apiService.createCheckoutSession(planId, successUrl, cancelUrl),
    onSuccess: (data) => {
      window.location.href = data.url;
    },
  });
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();
  return useMutation<any, Error, void>({
    mutationFn: () => apiService.cancelSubscription(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
    },
  });
}

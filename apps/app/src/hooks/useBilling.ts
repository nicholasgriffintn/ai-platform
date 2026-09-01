import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { USAGE_QUERY_KEYS } from "~/hooks/useUsage";
import { apiService } from "~/lib/api/api-service";
import { createBillingPortalSession, listPlans, setOverageEnabled } from "~/lib/api/usage";

const PORTAL_AVAILABILITY_KEY = ["stripe", "portal-available"] as const;
const OVERAGE_AVAILABILITY_KEY = ["stripe", "overage-available"] as const;

export function useSubscription() {
  return useQuery<any | null>({
    queryKey: ["subscription"],
    queryFn: () => apiService.getSubscription(),
  });
}

export function usePlans() {
  return useQuery({
    queryKey: ["plans"],
    queryFn: () => listPlans(),
    staleTime: 10 * 60 * 1000,
  });
}

function useStripeFeatureAvailability(key: readonly string[]) {
  const { data } = useQuery({
    queryKey: key,
    queryFn: () => true,
    enabled: false,
    initialData: true,
    staleTime: Number.POSITIVE_INFINITY,
  });

  return data;
}

export function useBillingPortalAvailability() {
  return useStripeFeatureAvailability(PORTAL_AVAILABILITY_KEY);
}

export function useOverageAvailability() {
  return useStripeFeatureAvailability(OVERAGE_AVAILABILITY_KEY);
}

export function useOpenBillingPortal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => createBillingPortalSession(window.location.href),
    onSuccess: (session) => {
      if (!session) {
        queryClient.setQueryData(PORTAL_AVAILABILITY_KEY, false);

        return;
      }

      window.location.href = session.url;
    },
  });
}

export function useSetOverage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (enabled: boolean) => setOverageEnabled(enabled),
    onSuccess: (result) => {
      if (!result) {
        queryClient.setQueryData(OVERAGE_AVAILABILITY_KEY, false);

        return;
      }

      void queryClient.invalidateQueries({ queryKey: USAGE_QUERY_KEYS.balance });
    },
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

  return useMutation<any>({
    mutationFn: () => apiService.cancelSubscription(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["subscription"] });
    },
  });
}

export function useReactivateSubscription() {
  const queryClient = useQueryClient();

  return useMutation<any>({
    mutationFn: () => apiService.reactivateSubscription(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["subscription"] });
    },
  });
}

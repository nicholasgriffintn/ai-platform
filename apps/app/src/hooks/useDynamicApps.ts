import { useMutation, useQuery } from "@tanstack/react-query";

import {
  executeDynamicApp,
  fetchDynamicAppById,
  fetchDynamicApps,
} from "~/lib/api/dynamic-apps";

export const DYNAMIC_APPS_QUERY_KEYS = {
  all: ["dynamicApps"],
  byId: (id: string | null) => ["dynamicApp", id],
};

export function useDynamicApps() {
  return useQuery({
    queryKey: DYNAMIC_APPS_QUERY_KEYS.all,
    queryFn: fetchDynamicApps,
  });
}

export function useDynamicApp(id: string | null) {
  return useQuery({
    queryKey: DYNAMIC_APPS_QUERY_KEYS.byId(id),
    queryFn: () =>
      id ? fetchDynamicAppById(id) : Promise.reject("No app ID provided"),
    enabled: !!id,
  });
}

export function useExecuteDynamicApp() {
  return useMutation({
    mutationFn: ({
      id,
      formData,
    }: { id: string; formData: Record<string, any> }) =>
      executeDynamicApp(id, formData),
  });
}

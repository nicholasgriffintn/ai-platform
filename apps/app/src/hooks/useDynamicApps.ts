import { useMutation, useQuery } from "@tanstack/react-query";

import {
  executeDynamicApp,
  fetchDynamicAppById,
  fetchDynamicAppResponseById,
  fetchDynamicAppResponses,
  fetchDynamicApps,
} from "~/lib/api/dynamic-apps";

export const DYNAMIC_APPS_QUERY_KEYS = {
  all: ["dynamicApps"],
  byId: (id: string | null) => ["dynamicApp", id],
  responseById: (responseId: string | null) => [
    "dynamicAppResponse",
    responseId,
  ],
  responsesList: (appId?: string) => ["dynamicAppResponses", appId],
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

export function useDynamicAppResponse(responseId: string | null) {
  return useQuery({
    queryKey: DYNAMIC_APPS_QUERY_KEYS.responseById(responseId),
    queryFn: () =>
      responseId
        ? fetchDynamicAppResponseById(responseId)
        : Promise.reject("No response ID provided"),
    enabled: !!responseId,
  });
}

export function useDynamicAppResponses(appId?: string) {
  return useQuery({
    queryKey: DYNAMIC_APPS_QUERY_KEYS.responsesList(appId),
    queryFn: () => fetchDynamicAppResponses(appId),
  });
}

export function useExecuteDynamicApp() {
  return useMutation({
    mutationFn: ({
      id,
      formData,
    }: {
      id: string;
      formData: Record<string, any>;
    }) => executeDynamicApp(id, formData),
  });
}

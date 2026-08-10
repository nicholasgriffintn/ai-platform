import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
	responseById: (responseId: string | null, projectId?: string) => [
		"dynamicAppResponse",
		projectId,
		responseId,
	],
	responses: (projectId?: string) => ["dynamicAppResponses", projectId],
	responsesList: (projectId?: string, appId?: string) => [
		...DYNAMIC_APPS_QUERY_KEYS.responses(projectId),
		appId,
	],
};

const DYNAMIC_CATALOG_STALE_TIME = 30 * 60 * 1000;
const DYNAMIC_CATALOG_GC_TIME = 60 * 60 * 1000;

export function useDynamicApps() {
	return useQuery({
		queryKey: DYNAMIC_APPS_QUERY_KEYS.all,
		queryFn: fetchDynamicApps,
		staleTime: DYNAMIC_CATALOG_STALE_TIME,
		gcTime: DYNAMIC_CATALOG_GC_TIME,
	});
}

export function useDynamicApp(id: string | null) {
	return useQuery({
		queryKey: DYNAMIC_APPS_QUERY_KEYS.byId(id),
		queryFn: () => (id ? fetchDynamicAppById(id) : Promise.reject("No app ID provided")),
		enabled: !!id,
		staleTime: DYNAMIC_CATALOG_STALE_TIME,
		gcTime: DYNAMIC_CATALOG_GC_TIME,
	});
}

export function useDynamicAppResponse(responseId: string | null, projectId?: string) {
	return useQuery({
		queryKey: DYNAMIC_APPS_QUERY_KEYS.responseById(responseId, projectId),
		queryFn: () =>
			responseId
				? fetchDynamicAppResponseById(responseId, projectId)
				: Promise.reject("No response ID provided"),
		enabled: !!responseId,
	});
}

export function useDynamicAppResponses(
	projectId?: string,
	appId?: string,
	options?: { enabled?: boolean },
) {
	return useQuery({
		queryKey: DYNAMIC_APPS_QUERY_KEYS.responsesList(projectId, appId),
		queryFn: () => fetchDynamicAppResponses(appId, projectId),
		enabled: options?.enabled ?? true,
	});
}

export function useExecuteDynamicApp() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			id,
			formData,
			projectId,
		}: {
			id: string;
			formData: Record<string, any>;
			projectId: string;
		}) => executeDynamicApp(id, formData, projectId),
		onSuccess: (_, { projectId }) => {
			queryClient.invalidateQueries({
				queryKey: DYNAMIC_APPS_QUERY_KEYS.responses(projectId),
			});
		},
	});
}

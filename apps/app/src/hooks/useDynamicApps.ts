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
	responseById: (responseId: string | null, projectId?: string) => [
		"dynamicAppResponse",
		projectId,
		responseId,
	],
	responsesList: (projectId?: string, appId?: string) => ["dynamicAppResponses", projectId, appId],
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
		queryFn: () => (id ? fetchDynamicAppById(id) : Promise.reject("No app ID provided")),
		enabled: !!id,
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

export function useDynamicAppResponses(projectId?: string, appId?: string) {
	return useQuery({
		queryKey: DYNAMIC_APPS_QUERY_KEYS.responsesList(projectId, appId),
		queryFn: () => fetchDynamicAppResponses(appId, projectId),
	});
}

export function useExecuteDynamicApp() {
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
	});
}

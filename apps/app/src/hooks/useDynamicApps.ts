import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { executeDynamicApp, fetchDynamicAppById, fetchDynamicApps } from "~/lib/api/dynamic-apps";

export const DYNAMIC_APPS_QUERY_KEYS = {
	all: ["dynamicApps"],
	byId: (id: string | null) => ["dynamicApp", id],
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
				queryKey: ["outputs", "list", projectId],
			});
		},
	});
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
	CreateSourceCollectionInput,
	CreateSourceInput,
	SourceKind,
} from "@assistant/schemas";

import {
	addCollectionSources,
	createSource,
	createSourceCollection,
	deleteSource,
	deleteSourceCollection,
	listCollectionSources,
	listSourceCollections,
	listSources,
	listProjectContextSources,
	setProjectContextSources,
} from "~/lib/api/sources";

export const SOURCE_QUERY_KEYS = {
	all: ["sources"] as const,
	list: (projectId?: string, kind?: SourceKind, collectionId?: string | null) =>
		["sources", "list", projectId, kind, collectionId] as const,
	collections: (projectId?: string) => ["sources", "collections", projectId] as const,
	projectContext: (projectId: string) => ["sources", "project-context", projectId] as const,
};

export function useSources(
	filters: {
		projectId?: string;
		kind?: SourceKind;
		collectionId?: string | null;
	} = {},
	options: { enabled?: boolean } = {},
) {
	return useQuery({
		queryKey: SOURCE_QUERY_KEYS.list(filters.projectId, filters.kind, filters.collectionId),
		queryFn: () =>
			filters.collectionId
				? listCollectionSources(filters.collectionId)
				: listSources({ projectId: filters.projectId, kind: filters.kind }),
		enabled: options.enabled,
	});
}

export function useSourceCollections(projectId?: string) {
	return useQuery({
		queryKey: SOURCE_QUERY_KEYS.collections(projectId),
		queryFn: () => listSourceCollections(projectId),
	});
}

export function useProjectContextSources(projectId: string) {
	return useQuery({
		queryKey: SOURCE_QUERY_KEYS.projectContext(projectId),
		queryFn: () => listProjectContextSources(projectId),
		enabled: Boolean(projectId),
	});
}

export function useSetProjectContextSources(projectId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (sourceIds: string[]) => setProjectContextSources(projectId, sourceIds),
		onSuccess: (sources) => {
			queryClient.setQueryData(SOURCE_QUERY_KEYS.projectContext(projectId), sources);
			queryClient.invalidateQueries({ queryKey: SOURCE_QUERY_KEYS.collections(projectId) });
		},
	});
}

export function useSourceMutations() {
	const queryClient = useQueryClient();
	const invalidate = () => queryClient.invalidateQueries({ queryKey: SOURCE_QUERY_KEYS.all });
	return {
		createSource: useMutation({
			mutationFn: (input: CreateSourceInput) => createSource(input),
			onSuccess: invalidate,
		}),
		deleteSource: useMutation({
			mutationFn: deleteSource,
			onSuccess: invalidate,
		}),
		createCollection: useMutation({
			mutationFn: (input: CreateSourceCollectionInput) => createSourceCollection(input),
			onSuccess: invalidate,
		}),
		deleteCollection: useMutation({
			mutationFn: deleteSourceCollection,
			onSuccess: invalidate,
		}),
		addToCollection: useMutation({
			mutationFn: ({ collectionId, sourceId }: { collectionId: string; sourceId: string }) =>
				addCollectionSources(collectionId, [sourceId]),
			onSuccess: invalidate,
		}),
	};
}

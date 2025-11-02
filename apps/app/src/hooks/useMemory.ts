import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { memoryService } from "~/lib/api/memory-service";
import type { Memory, MemoryGroup } from "~/types/chat";

export const MEMORY_QUERY_KEYS = {
	memories: (groupId?: string) => ["memories", groupId],
	groups: ["memory-groups"],
};

interface ListMemoriesResponse {
	memories: Memory[];
	groups: MemoryGroup[];
}

interface CreateGroupResponse {
	id: string;
	title: string;
	description: string | null;
	category: string | null;
	created_at: string;
}

interface DeleteMemoryResponse {
	success: boolean;
	deleted_from_groups: number;
}

interface DeleteGroupResponse {
	success: boolean;
}

export function useMemories(groupId?: string) {
	const queryClient = useQueryClient();

	const { data: memoriesData } = useQuery<ListMemoriesResponse>({
		queryKey: MEMORY_QUERY_KEYS.memories(groupId),
		queryFn: () => memoryService.listMemories(groupId),
		staleTime: 1000 * 60 * 2, // 2 minutes
	});

	const createGroupMutation = useMutation<
		CreateGroupResponse,
		Error,
		{
			title: string;
			description?: string;
			category?: string;
		}
	>({
		mutationFn: async (data) => {
			return await memoryService.createGroup(data);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: MEMORY_QUERY_KEYS.memories() });
			queryClient.invalidateQueries({ queryKey: MEMORY_QUERY_KEYS.groups });
		},
	});

	const deleteMemoryMutation = useMutation<DeleteMemoryResponse, Error, string>(
		{
			mutationFn: async (memoryId: string) => {
				return await memoryService.deleteMemory(memoryId);
			},
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: MEMORY_QUERY_KEYS.memories(),
				});
				queryClient.invalidateQueries({ queryKey: MEMORY_QUERY_KEYS.groups });
			},
		},
	);

	const deleteGroupMutation = useMutation<DeleteGroupResponse, Error, string>({
		mutationFn: async (groupId: string) => {
			return await memoryService.deleteGroup(groupId);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: MEMORY_QUERY_KEYS.memories() });
			queryClient.invalidateQueries({ queryKey: MEMORY_QUERY_KEYS.groups });
		},
	});

	const addMemoriesToGroupMutation = useMutation<
		{ success: boolean; added_count: number },
		Error,
		{ groupId: string; memoryIds: string[] }
	>({
		mutationFn: async ({ groupId, memoryIds }) => {
			return await memoryService.addMemoriesToGroup(groupId, memoryIds);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: MEMORY_QUERY_KEYS.memories() });
			queryClient.invalidateQueries({ queryKey: MEMORY_QUERY_KEYS.groups });
		},
	});

	return {
		memories: memoriesData?.memories || [],
		groups: memoriesData?.groups || [],

		createGroup: createGroupMutation.mutate,
		isCreatingGroup: createGroupMutation.isPending,

		deleteMemory: deleteMemoryMutation.mutate,
		isDeletingMemory: deleteMemoryMutation.isPending,

		deleteGroup: deleteGroupMutation.mutate,

		addMemoriesToGroup: addMemoriesToGroupMutation.mutate,
		isAddingMemoriesToGroup: addMemoriesToGroupMutation.isPending,
	};
}

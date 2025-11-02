import type { Memory, MemoryGroup } from "~/types/chat";
import { fetchApi } from "./fetch-wrapper";

interface ListMemoriesResponse {
	memories: Memory[];
	groups: MemoryGroup[];
}

interface CreateGroupRequest {
	title: string;
	description?: string;
	category?: string;
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

class MemoryService {
	private static instance: MemoryService;

	private constructor() {}

	public static getInstance(): MemoryService {
		if (!MemoryService.instance) {
			MemoryService.instance = new MemoryService();
		}
		return MemoryService.instance;
	}

	public async listMemories(groupId?: string): Promise<ListMemoriesResponse> {
		try {
			const url = groupId ? `/memories?group_id=${groupId}` : "/memories";
			const response = await fetchApi(url, {
				method: "GET",
			});

			if (!response.ok) {
				throw new Error("Failed to fetch memories");
			}

			return await response.json();
		} catch (error) {
			console.error("Error listing memories:", error);
			throw error;
		}
	}

	public async createGroup(
		data: CreateGroupRequest,
	): Promise<CreateGroupResponse> {
		try {
			const response = await fetchApi("/memories/groups", {
				method: "POST",
				body: data,
			});

			if (!response.ok) {
				const errorData = (await response.json().catch(() => ({}))) as {
					error?: string;
				};
				throw new Error(errorData.error || "Failed to create group");
			}

			return await response.json();
		} catch (error) {
			console.error("Error creating memory group:", error);
			throw error;
		}
	}

	public async deleteMemory(memoryId: string): Promise<DeleteMemoryResponse> {
		try {
			const response = await fetchApi(`/memories/${memoryId}`, {
				method: "DELETE",
			});

			if (!response.ok) {
				const errorData = (await response.json().catch(() => ({}))) as {
					error?: string;
				};
				throw new Error(errorData.error || "Failed to delete memory");
			}

			return await response.json();
		} catch (error) {
			console.error("Error deleting memory:", error);
			throw error;
		}
	}

	public async addMemoriesToGroup(
		groupId: string,
		memoryIds: string[],
	): Promise<{ success: boolean; added_count: number }> {
		try {
			const response = await fetchApi(`/memories/groups/${groupId}/memories`, {
				method: "POST",
				body: { memory_ids: memoryIds },
			});

			if (!response.ok) {
				const errorData = (await response.json().catch(() => ({}))) as {
					error?: string;
				};
				throw new Error(errorData.error || "Failed to add memories to group");
			}

			return await response.json();
		} catch (error) {
			console.error("Error adding memories to group:", error);
			throw error;
		}
	}

	public async deleteGroup(groupId: string): Promise<DeleteGroupResponse> {
		try {
			const response = await fetchApi(`/memories/groups/${groupId}`, {
				method: "DELETE",
			});

			if (!response.ok) {
				const errorData = (await response.json().catch(() => ({}))) as {
					error?: string;
				};
				throw new Error(errorData.error || "Failed to delete group");
			}

			return await response.json();
		} catch (error) {
			console.error("Error deleting group:", error);
			throw error;
		}
	}
}

export const memoryService = MemoryService.getInstance();

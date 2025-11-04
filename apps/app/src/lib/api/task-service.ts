import type {
	ListTasksResponse,
	GetTaskResponse,
	CreateTaskResponse,
	TriggerMemorySynthesisRequest,
	MemorySynthesis,
	GetMemorySynthesisResponse,
} from "@assistant/schemas";
import { fetchApi, returnFetchedData } from "./fetch-wrapper";

interface MemorySynthesisHistoryResponse {
	syntheses: MemorySynthesis[];
	total: number;
}

class TaskService {
	private static instance: TaskService;

	private constructor() {}

	public static getInstance(): TaskService {
		if (!TaskService.instance) {
			TaskService.instance = new TaskService();
		}
		return TaskService.instance;
	}

	public async listTasks(): Promise<ListTasksResponse> {
		try {
			const response = await fetchApi("/tasks", {
				method: "GET",
			});

			if (!response.ok) {
				throw new Error("Failed to fetch tasks");
			}

			return await returnFetchedData<ListTasksResponse>(response);
		} catch (error) {
			console.error("Error listing tasks:", error);
			throw error;
		}
	}

	public async getTask(taskId: string): Promise<GetTaskResponse> {
		try {
			const response = await fetchApi(`/tasks/${taskId}`, {
				method: "GET",
			});

			if (!response.ok) {
				throw new Error("Failed to fetch task");
			}

			return await returnFetchedData<GetTaskResponse>(response);
		} catch (error) {
			console.error("Error fetching task:", error);
			throw error;
		}
	}

	public async cancelTask(taskId: string): Promise<{ success: boolean }> {
		try {
			const response = await fetchApi(`/tasks/${taskId}`, {
				method: "DELETE",
			});

			if (!response.ok) {
				const errorData = await returnFetchedData<{ error?: string }>(response);
				throw new Error(errorData.error || "Failed to cancel task");
			}

			return await returnFetchedData<{ success: boolean }>(response);
		} catch (error) {
			console.error("Error cancelling task:", error);
			throw error;
		}
	}

	public async triggerMemorySynthesis(
		data?: TriggerMemorySynthesisRequest,
	): Promise<CreateTaskResponse> {
		try {
			const response = await fetchApi("/tasks/memory-synthesis", {
				method: "POST",
				body: data || {},
			});

			if (!response.ok) {
				const errorData = await returnFetchedData<{ error?: string }>(response);
				throw new Error(
					errorData.error || "Failed to trigger memory synthesis",
				);
			}

			return await returnFetchedData<CreateTaskResponse>(response);
		} catch (error) {
			console.error("Error triggering memory synthesis:", error);
			throw error;
		}
	}

	public async getActiveSynthesis(
		namespace = "global",
	): Promise<GetMemorySynthesisResponse> {
		try {
			const response = await fetchApi(
				`/tasks/memory/synthesis?namespace=${namespace}`,
				{
					method: "GET",
				},
			);

			if (!response.ok) {
				throw new Error("Failed to fetch memory synthesis");
			}

			return await returnFetchedData<GetMemorySynthesisResponse>(response);
		} catch (error) {
			console.error("Error fetching memory synthesis:", error);
			throw error;
		}
	}

	public async getSynthesisHistory(
		namespace = "global",
		limit = 10,
	): Promise<MemorySynthesisHistoryResponse> {
		try {
			const response = await fetchApi(
				`/tasks/memory/syntheses?namespace=${namespace}&limit=${limit}`,
				{
					method: "GET",
				},
			);

			if (!response.ok) {
				throw new Error("Failed to fetch synthesis history");
			}

			return await returnFetchedData<MemorySynthesisHistoryResponse>(response);
		} catch (error) {
			console.error("Error fetching synthesis history:", error);
			throw error;
		}
	}
}

export const taskService = TaskService.getInstance();

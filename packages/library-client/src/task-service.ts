import type {
  AdminTaskDetail,
  AdminTasksResponse,
  AdminTaskView,
  ListTasksResponse,
  GetTaskResponse,
  CreateTaskResponse,
  TriggerMemorySynthesisRequest,
  MemorySynthesis,
  GetMemorySynthesisResponse,
  ListPage,
} from "@ngriffin_uk/polychat-schemas";

import { fetchApi } from "./fetch-wrapper.js";
import { createApiErrorFromResponse, returnFetchedData } from "./http.js";

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

  public async listAdminTasks(view: AdminTaskView, taskType?: string): Promise<AdminTasksResponse> {
    const query = new URLSearchParams({ view });

    if (taskType) {
      query.set("task_type", taskType);
    }

    const response = await fetchApi(`/admin/tasks?${query.toString()}`, { method: "GET" });

    if (!response.ok) {
      throw await createApiErrorFromResponse(response, "Failed to fetch background tasks");
    }

    return await returnFetchedData<AdminTasksResponse>(response);
  }

  public async getAdminTask(taskId: string): Promise<AdminTaskDetail> {
    const response = await fetchApi(`/admin/tasks/${encodeURIComponent(taskId)}`, {
      method: "GET",
    });

    if (!response.ok) {
      throw await createApiErrorFromResponse(response, "Failed to fetch the task");
    }

    return await returnFetchedData<AdminTaskDetail>(response);
  }

  public async actOnAdminTask(
    taskId: string,
    action: "retry" | "cancel",
  ): Promise<AdminTaskDetail> {
    const response = await fetchApi(`/admin/tasks/${encodeURIComponent(taskId)}/${action}`, {
      method: "POST",
    });

    if (!response.ok) {
      throw await createApiErrorFromResponse(response, `Failed to ${action} the task`);
    }

    return await returnFetchedData<AdminTaskDetail>(response);
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
      const response = await fetchApi(`/tasks/${encodeURIComponent(taskId)}/cancel`, {
        method: "POST",
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
      const response = await fetchApi("/memory/syntheses", {
        method: "POST",
        body: data || {},
      });

      if (!response.ok) {
        const errorData = await returnFetchedData<{ error?: string }>(response);

        throw new Error(errorData.error || "Failed to trigger memory synthesis");
      }

      return await returnFetchedData<CreateTaskResponse>(response);
    } catch (error) {
      console.error("Error triggering memory synthesis:", error);
      throw error;
    }
  }

  public async getActiveSynthesis(): Promise<GetMemorySynthesisResponse> {
    try {
      const response = await fetchApi("/memory/syntheses?active=true", { method: "GET" });

      if (!response.ok) {
        throw new Error("Failed to fetch memory synthesis");
      }

      const page = await returnFetchedData<ListPage<MemorySynthesis>>(response);

      return { synthesis: page.data[0] };
    } catch (error) {
      console.error("Error fetching memory synthesis:", error);
      throw error;
    }
  }

  public async getSynthesisHistory(limit = 10): Promise<ListPage<MemorySynthesis>> {
    try {
      const response = await fetchApi(`/memory/syntheses?limit=${limit}`, { method: "GET" });

      if (!response.ok) {
        throw new Error("Failed to fetch synthesis history");
      }

      return await returnFetchedData<ListPage<MemorySynthesis>>(response);
    } catch (error) {
      console.error("Error fetching synthesis history:", error);
      throw error;
    }
  }
}

export const taskService = TaskService.getInstance();

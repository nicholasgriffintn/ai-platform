import { returnFetchedData } from "@ngriffin_uk/polychat-library-client";
import type {
  ProjectTaskAttentionResponse,
  RegisterTaskNotification,
  TaskNotificationRegistration,
  TaskNotificationSettings,
  UpdateTaskNotificationPreferences,
} from "@ngriffin_uk/polychat-schemas";

import { apiService } from "./api-service";
import { fetchApiOrThrow } from "./fetch-wrapper";

async function authHeaders() {
  return apiService.getHeaders();
}

export async function listTaskInbox(): Promise<ProjectTaskAttentionResponse> {
  const response = await fetchApiOrThrow("/notifications/inbox", {
    method: "GET",
    headers: await authHeaders(),
  });

  return returnFetchedData(response);
}

export async function updateTaskInboxReceipts(
  itemIds: string[],
  action: "read" | "dismiss",
): Promise<{ updated: number }> {
  const response = await fetchApiOrThrow(`/notifications/inbox/${action}`, {
    method: "POST",
    headers: await authHeaders(),
    body: { itemIds },
  });

  return returnFetchedData(response);
}

export async function getTaskNotificationSettings(): Promise<TaskNotificationSettings> {
  const response = await fetchApiOrThrow("/notifications/settings", {
    method: "GET",
    headers: await authHeaders(),
  });

  return returnFetchedData(response);
}

export async function updateTaskNotificationSettings(
  updates: UpdateTaskNotificationPreferences,
): Promise<TaskNotificationSettings> {
  const response = await fetchApiOrThrow("/notifications/settings", {
    method: "PUT",
    headers: await authHeaders(),
    body: updates,
  });

  return returnFetchedData(response);
}

export async function registerTaskNotifications(
  input: RegisterTaskNotification,
): Promise<TaskNotificationRegistration> {
  const response = await fetchApiOrThrow("/notifications/registrations", {
    method: "POST",
    headers: await authHeaders(),
    body: input,
  });
  const result = await returnFetchedData<{ registration: TaskNotificationRegistration }>(response);

  return result.registration;
}

export async function removeTaskNotificationRegistration(installationId: string): Promise<void> {
  await fetchApiOrThrow(`/notifications/registrations/${encodeURIComponent(installationId)}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });
}

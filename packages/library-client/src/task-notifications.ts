import type {
  ProjectTaskAttentionResponse,
  RegisterTaskNotification,
  TaskNotificationRegistration,
  TaskNotificationSettings,
  UpdateTaskNotificationPreferences,
} from "@ngriffin_uk/polychat-schemas";

import { requestJson, singleton } from "./resource.js";

const NOTIFICATIONS_PATH = "/notifications";
const settings = singleton<TaskNotificationSettings, UpdateTaskNotificationPreferences>(
  `${NOTIFICATIONS_PATH}/settings`,
);

export function listTaskInbox(): Promise<ProjectTaskAttentionResponse> {
  return requestJson<ProjectTaskAttentionResponse>(NOTIFICATIONS_PATH, "GET");
}

export function updateTaskInboxReceipts(
  itemIds: string[],
  action: "read" | "dismiss",
): Promise<{ updated: number }> {
  return requestJson<{ updated: number }>(`${NOTIFICATIONS_PATH}/${action}`, "POST", { itemIds });
}

export function getTaskNotificationSettings(): Promise<TaskNotificationSettings> {
  return settings.get();
}

export function updateTaskNotificationSettings(
  updates: UpdateTaskNotificationPreferences,
): Promise<TaskNotificationSettings> {
  return settings.update(updates);
}

export async function registerTaskNotifications(
  input: RegisterTaskNotification,
): Promise<TaskNotificationRegistration> {
  const result = await requestJson<{ registration: TaskNotificationRegistration }>(
    `${NOTIFICATIONS_PATH}/registrations`,
    "POST",
    input,
  );

  return result.registration;
}

export async function removeTaskNotificationRegistration(installationId: string): Promise<void> {
  await requestJson<unknown>(
    `${NOTIFICATIONS_PATH}/registrations/${encodeURIComponent(installationId)}`,
    "DELETE",
  );
}

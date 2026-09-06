import {
  TASK_NOTIFICATION_DELIVERY_TASK_TYPE,
  TASK_NOTIFICATION_PROTOCOL_VERSION,
  createTaskInboxItemId,
  parseTaskInboxItemId,
  projectTaskBlockedReasonLabels,
  type ProjectTask,
  type ProjectTaskAttentionItem,
  type ProjectTaskAttentionKind,
  type RegisterTaskNotification,
  type TaskNotificationCategory,
  type UpdateTaskNotificationPreferences,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { TaskInboxRow } from "~/repositories/TaskNotificationRepository";
import { notifyMobileProjectTask } from "~/services/mobile-push";
import { TaskService } from "~/services/tasks/TaskService";
import { requireProjectAccess, requireWorkAccess } from "~/services/workspaces/access";
import { AssistantError, ErrorType, getErrorMessage } from "~/utils/errors";

const DEFAULT_ATTENTION_LIMIT = 50;

interface TaskAttentionState {
  kind: ProjectTaskAttentionKind;
  category: TaskNotificationCategory;
  requiresAction: boolean;
}

export function isTaskInboxEligible(
  task: Pick<ProjectTask, "assigneeUserId" | "createdByUserId">,
  state: TaskAttentionState,
  userId: number,
): boolean {
  if (state.category === "assignments") {
    return task.assigneeUserId === userId;
  }

  if (state.category === "completions") {
    return task.createdByUserId === userId || task.assigneeUserId === userId;
  }

  return true;
}

function attentionState(
  task: Pick<ProjectTask, "status" | "blockedReason">,
): TaskAttentionState | null {
  if (task.status === "blocked") {
    if (task.blockedReason === "awaiting_input") {
      return { kind: "input", category: "decisions", requiresAction: true };
    }

    if (task.blockedReason === "awaiting_approval") {
      return { kind: "approval", category: "decisions", requiresAction: true };
    }

    return { kind: "blocked", category: "failures", requiresAction: true };
  }

  if (task.status === "review") {
    return { kind: "review", category: "decisions", requiresAction: true };
  }

  if (task.status === "backlog") {
    return { kind: "assigned", category: "assignments", requiresAction: true };
  }

  if (task.status === "done") {
    return { kind: "completion", category: "completions", requiresAction: false };
  }

  return null;
}

function attentionDetail(task: TaskInboxRow): string | null {
  if (task.status === "blocked" && task.blocked_reason) {
    return (
      task.blocked_detail ??
      projectTaskBlockedReasonLabels[task.blocked_reason] ??
      "This task needs attention"
    );
  }

  if (task.status === "review") {
    return "The assistant believes this is done and is waiting for you to accept it";
  }

  if (task.status === "done") {
    return "The task completed successfully";
  }

  return task.blocked_detail;
}

function deepLinkFor(task: Pick<TaskInboxRow, "workspace_id" | "project_id" | "task_id">) {
  return `/work/${encodeURIComponent(task.workspace_id)}/projects/${encodeURIComponent(
    task.project_id,
  )}/tasks/${encodeURIComponent(task.task_id)}`;
}

function formatInboxItem(row: TaskInboxRow): ProjectTaskAttentionItem | null {
  const state = attentionState({
    status: row.status,
    blockedReason: row.blocked_reason,
  });

  if (!state) {
    return null;
  }

  return {
    id: createTaskInboxItemId(row.task_id, row.task_version),
    kind: state.kind,
    taskId: row.task_id,
    projectId: row.project_id,
    workspaceId: row.workspace_id,
    projectName: row.project_name,
    objective: row.objective,
    detail: attentionDetail(row),
    conversationId: row.conversation_id,
    since: row.completed_at ?? row.updated_at,
    requiresAction: state.requiresAction,
    isRead: row.read_at !== null,
    readAt: row.read_at,
    deepLink: deepLinkFor(row),
  };
}

export async function listProjectTaskAttention(
  context: ServiceContext,
  options: { limit?: number } = {},
) {
  const user = requireWorkAccess(context);
  const limit = Math.min(options.limit ?? DEFAULT_ATTENTION_LIMIT, 100);
  const rows = await context.repositories.taskNotifications.listInbox(user.id, limit);
  const items = rows
    .map(formatInboxItem)
    .filter((item): item is ProjectTaskAttentionItem => item !== null);

  return {
    items,
    total: items.length,
    unread: items.filter((item) => !item.isRead).length,
  };
}

export async function getTaskNotificationSettings(context: ServiceContext) {
  const user = context.requireUser();
  const [preferences, registrations] = await Promise.all([
    context.repositories.taskNotifications.getPreferences(user.id),
    context.repositories.taskNotifications.listRegistrations(user.id),
  ]);

  return {
    protocolVersion: TASK_NOTIFICATION_PROTOCOL_VERSION,
    preferences,
    registrations,
    webPushPublicKey: context.env.WEB_PUSH_PUBLIC_KEY ?? null,
  };
}

export async function updateTaskNotificationPreferences(
  context: ServiceContext,
  updates: UpdateTaskNotificationPreferences,
) {
  const user = context.requireUser();
  const preferences = await context.repositories.taskNotifications.updatePreferences(
    user.id,
    updates,
  );

  return {
    ...(await getTaskNotificationSettings(context)),
    preferences,
  };
}

export async function registerTaskNotification(
  context: ServiceContext,
  input: RegisterTaskNotification,
) {
  const user = context.requireUser();
  const registration = await context.repositories.taskNotifications.upsertRegistration(
    user.id,
    input,
  );

  return { registration };
}

export async function removeTaskNotificationRegistration(
  context: ServiceContext,
  installationId: string,
) {
  const user = context.requireUser();

  await context.repositories.taskNotifications.removeRegistration(user.id, installationId);

  return { success: true };
}

export async function updateTaskInboxReceipts(
  context: ServiceContext,
  itemIds: string[],
  action: "read" | "dismiss",
) {
  const user = requireWorkAccess(context);
  const updated = await context.repositories.taskNotifications.updateInboxReceipts(
    user.id,
    itemIds,
    action,
  );

  return { updated };
}

export async function resolveTaskNotificationDeepLink(context: ServiceContext, itemId: string) {
  const user = requireWorkAccess(context);
  const parsed = parseTaskInboxItemId(itemId);

  if (!parsed) {
    throw new AssistantError("Notification link is invalid", ErrorType.PARAMS_ERROR, 400);
  }

  const task = await context.repositories.projectTasks.getTaskById(parsed.taskId);

  if (!task) {
    return {
      protocolVersion: TASK_NOTIFICATION_PROTOCOL_VERSION,
      itemId,
      current: false,
      deepLink: null,
    };
  }

  await requireProjectAccess(context, task.projectId);
  const state = attentionState(task);
  const current =
    state !== null &&
    isTaskInboxEligible(task, state, user.id) &&
    task.attentionVersion === parsed.taskVersion;

  return {
    protocolVersion: TASK_NOTIFICATION_PROTOCOL_VERSION,
    itemId,
    current,
    deepLink: current
      ? `/work/${encodeURIComponent(task.workspaceId)}/projects/${encodeURIComponent(
          task.projectId,
        )}/tasks/${encodeURIComponent(task.id)}`
      : null,
  };
}

function notificationRecipients(
  task: ProjectTask,
  state: TaskAttentionState,
  workspaceUserIds: readonly number[],
): number[] {
  const members = new Set(workspaceUserIds);

  if (state.category === "assignments") {
    return task.assigneeUserId && members.has(task.assigneeUserId) ? [task.assigneeUserId] : [];
  }

  if (state.category === "completions") {
    return [...new Set([task.createdByUserId, task.assigneeUserId])].filter(
      (userId): userId is number => typeof userId === "number" && members.has(userId),
    );
  }

  return [...members];
}

export async function reconcileTaskNotifications(
  context: ServiceContext,
  task: ProjectTask,
  options: { notifyMobile?: boolean } = {},
): Promise<void> {
  const state = attentionState(task);

  if (!state || !task.attentionVersion) {
    return;
  }

  try {
    const mobileKind =
      state.kind === "completion" ? "completed" : state.kind === "blocked" ? "failed" : state.kind;

    if (
      options.notifyMobile !== false &&
      (mobileKind !== "assigned" || task.assigneeUserId !== null)
    ) {
      await notifyMobileProjectTask({
        context,
        task,
        notificationId: `project-task:${task.id}:${mobileKind}:v${task.attentionVersion}`,
        kind: mobileKind,
      });
    }

    const members = await context.repositories.workspaces.listMembers(task.workspaceId);
    const recipients = notificationRecipients(
      task,
      state,
      members.map((member) => member.user_id),
    );
    const deliveryIds = await context.repositories.taskNotifications.createDeliveries(
      task.id,
      task.attentionVersion,
      state.category,
      recipients,
    );
    const taskService = new TaskService(context.env, context.repositories.tasks);

    await Promise.allSettled(
      deliveryIds.map((deliveryId) =>
        taskService.enqueueTask({
          id: `task-notification:${deliveryId}`,
          task_type: TASK_NOTIFICATION_DELIVERY_TASK_TYPE,
          task_data: { deliveryId },
          priority: 7,
        }),
      ),
    );
  } catch (error) {
    context
      .getLogger({ prefix: "services/project-tasks/notifications" })
      .warn("Task notification reconciliation failed", {
        taskId: task.id,
        error: getErrorMessage(error),
      });
  }
}

export { attentionState };

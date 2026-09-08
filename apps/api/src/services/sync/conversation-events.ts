import type { ChatRun, ChatRunEvent, DeviceSyncEventType } from "@ngriffin_uk/polychat-schemas";

import type { IEnv } from "~/types";

import { conversationAudience, projectAudience, workspaceAudience } from "./audience";
import { publishSyncEvent, syncTopic } from "./publish";

export async function publishConversationChanged(
  env: IEnv | undefined,
  conversationId: string,
  data: Record<string, unknown> = {},
  originDeviceId?: string | null,
): Promise<void> {
  const audience = await conversationAudience(env, conversationId);

  await Promise.all([
    publishSyncEvent(env, {
      audience,
      topic: syncTopic("conversation", conversationId),
      type: "conversation.changed",
      data: { conversationId, ...data },
      originDeviceId,
    }),
    ...audience.map((userId) =>
      publishSyncEvent(env, {
        audience: [userId],
        topic: syncTopic("user", userId),
        type: "conversation.changed",
        data: { conversationId, ...data },
        originDeviceId,
      }),
    ),
  ]);
}

export async function publishConversationDeleted(
  env: IEnv | undefined,
  conversationId: string,
  audience: number[],
): Promise<void> {
  await Promise.all(
    audience.map((userId) =>
      publishSyncEvent(env, {
        audience: [userId],
        topic: syncTopic("user", userId),
        type: "conversation.deleted",
        data: { conversationId },
      }),
    ),
  );
}

export async function publishRunChanged(env: IEnv | undefined, run: ChatRun): Promise<void> {
  const audience = await conversationAudience(env, run.conversationId);

  await Promise.all([
    publishSyncEvent(env, {
      audience,
      topic: syncTopic("conversation", run.conversationId),
      type: "run.changed",
      data: { runId: run.id, conversationId: run.conversationId, status: run.status },
    }),
    ...audience.map((userId) =>
      publishSyncEvent(env, {
        audience: [userId],
        topic: syncTopic("user", userId),
        type: "run.changed",
        data: { runId: run.id, conversationId: run.conversationId, status: run.status },
      }),
    ),
  ]);
}

export async function publishRunEvent(
  env: IEnv | undefined,
  conversationId: string,
  event: ChatRunEvent,
): Promise<void> {
  await publishSyncEvent(env, {
    audience: await conversationAudience(env, conversationId),
    topic: syncTopic("conversation", conversationId),
    type: "run.event",
    data: { conversationId, event },
  });
}

export async function publishProjectEvent(
  env: IEnv | undefined,
  projectId: string,
  type: DeviceSyncEventType,
  data: Record<string, unknown> = {},
): Promise<void> {
  await publishSyncEvent(env, {
    audience: await projectAudience(env, projectId),
    topic: syncTopic("project", projectId),
    type,
    data: { projectId, ...data },
  });
}

export async function publishWorkspaceEvent(
  env: IEnv | undefined,
  workspaceId: string,
  type: DeviceSyncEventType,
  data: Record<string, unknown> = {},
): Promise<void> {
  await publishSyncEvent(env, {
    audience: await workspaceAudience(env, workspaceId),
    topic: syncTopic("workspace", workspaceId),
    type,
    data: { workspaceId, ...data },
  });
}

export async function publishUserEvent(
  env: IEnv | undefined,
  userId: number,
  type: DeviceSyncEventType,
  data: Record<string, unknown> = {},
): Promise<void> {
  await publishSyncEvent(env, {
    audience: [userId],
    topic: syncTopic("user", userId),
    type,
    data,
  });
}

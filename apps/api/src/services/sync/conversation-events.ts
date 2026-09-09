import type {
  ChatRun,
  ChatRunEvent,
  Delegation,
  DeviceSyncEventType,
} from "@ngriffin_uk/polychat-schemas";

import { conversationAudience, projectAudience, workspaceAudience } from "./audience";
import {
  publishSync,
  syncTopic,
  withoutOrigin,
  type SyncPublication,
  type SyncPublisher,
} from "./publish";

function fanOut(
  audience: number[],
  topic: string,
  type: DeviceSyncEventType,
  data: Record<string, unknown>,
): SyncPublication[] {
  return [
    { audience, topic, type, data },
    ...audience.map((userId) => ({
      audience: [userId],
      topic: syncTopic("user", userId),
      type,
      data,
    })),
  ];
}

export async function publishConversationChanged(
  publisher: SyncPublisher,
  conversationId: string,
  data: Record<string, unknown> = {},
): Promise<void> {
  const audience = await conversationAudience(publisher.env, conversationId);

  publishSync(
    publisher,
    fanOut(audience, syncTopic("conversation", conversationId), "conversation.changed", {
      conversationId,
      ...data,
    }),
  );
}

export function publishConversationDeleted(
  publisher: SyncPublisher,
  conversationId: string,
  audience: number[],
): void {
  publishSync(
    publisher,
    audience.map((userId) => ({
      audience: [userId],
      topic: syncTopic("user", userId),
      type: "conversation.deleted" as const,
      data: { conversationId },
    })),
  );
}

export async function publishRunChanged(publisher: SyncPublisher, run: ChatRun): Promise<void> {
  const audience = await conversationAudience(publisher.env, run.conversationId);
  const data = { runId: run.id, conversationId: run.conversationId, status: run.status };

  publishSync(withoutOrigin(publisher), [
    ...fanOut(audience, syncTopic("conversation", run.conversationId), "run.changed", data),
    { audience, topic: syncTopic("run", run.id), type: "run.changed", data },
  ]);
}

export async function publishRunEvents(
  publisher: SyncPublisher,
  conversationId: string,
  runId: string,
  events: ChatRunEvent[],
): Promise<void> {
  if (events.length === 0) {
    return;
  }

  const audience = await conversationAudience(publisher.env, conversationId);

  publishSync(
    withoutOrigin(publisher),
    events.flatMap((event) => {
      const data = { conversationId, runId, event };

      return [
        {
          audience,
          topic: syncTopic("conversation", conversationId),
          type: "run.event" as const,
          data,
        },
        { audience, topic: syncTopic("run", runId), type: "run.event" as const, data },
      ];
    }),
  );
}

export async function publishMessageChanged(
  publisher: SyncPublisher,
  conversationId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const audience = await conversationAudience(publisher.env, conversationId);

  publishSync(
    publisher,
    fanOut(audience, syncTopic("conversation", conversationId), "message.changed", {
      conversationId,
      ...data,
    }),
  );
}

export async function publishProjectEvent(
  publisher: SyncPublisher,
  projectId: string,
  type: DeviceSyncEventType,
  data: Record<string, unknown> = {},
): Promise<void> {
  const audience = await projectAudience(publisher.env, projectId);

  publishSync(
    publisher,
    fanOut(audience, syncTopic("project", projectId), type, { projectId, ...data }),
  );
}

export async function publishWorkspaceEvent(
  publisher: SyncPublisher,
  workspaceId: string,
  type: DeviceSyncEventType,
  data: Record<string, unknown> = {},
): Promise<void> {
  const audience = await workspaceAudience(publisher.env, workspaceId);

  publishSync(
    publisher,
    fanOut(audience, syncTopic("workspace", workspaceId), type, { workspaceId, ...data }),
  );
}

export function publishUserEvent(
  publisher: SyncPublisher,
  userId: number,
  type: DeviceSyncEventType,
  data: Record<string, unknown> = {},
): void {
  publishSync(publisher, [{ audience: [userId], topic: syncTopic("user", userId), type, data }]);
}

export function publishMachineEvent(
  publisher: SyncPublisher,
  userId: number,
  machineId: string,
  data: Record<string, unknown> = {},
): void {
  publishSync(
    publisher,
    fanOut([userId], syncTopic("machine", machineId), "machine.changed", { machineId, ...data }),
  );
}

export async function publishDelegationChanged(
  publisher: SyncPublisher,
  delegation: Pick<Delegation, "id" | "state" | "parentConversationId" | "childConversationId">,
): Promise<void> {
  const audience = await conversationAudience(publisher.env, delegation.parentConversationId);
  const data = {
    delegationId: delegation.id,
    state: delegation.state,
    conversationId: delegation.parentConversationId,
    childConversationId: delegation.childConversationId,
  };

  publishSync(
    publisher,
    fanOut(
      audience,
      syncTopic("conversation", delegation.parentConversationId),
      "delegation.changed",
      data,
    ),
  );
}

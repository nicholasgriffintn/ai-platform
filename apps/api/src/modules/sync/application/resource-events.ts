import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { DeviceSyncEventType } from "@ngriffin_uk/polychat-schemas";

import { projectAudience } from "./audience";
import { publishSyncEvents, syncTopic, type SyncPublisher } from "./publish";

type ResourceEventScope =
  | { kind: "personal"; userId: number }
  | { kind: "project"; projectId: string };

export async function publishResourceEvent(
  publisher: SyncPublisher,
  scope: ResourceEventScope,
  type: DeviceSyncEventType,
  data: Record<string, unknown> = {},
): Promise<void> {
  if (!publisher.env?.USER_SYNC_COORDINATOR) {
    return;
  }

  try {
    const audience =
      scope.kind === "project"
        ? await projectAudience(publisher.env, scope.projectId)
        : [scope.userId];

    await publishSyncEvents(
      publisher.env,
      audience.map((userId) => ({
        audience: [userId],
        topic: syncTopic("user", userId),
        type,
        data: scope.kind === "project" ? { ...data, projectId: scope.projectId } : data,
      })),
    );
  } catch (error) {
    getLogger({ prefix: "sync/resource-events" }).error("Resource notification failed", {
      error,
      type,
    });
  }
}

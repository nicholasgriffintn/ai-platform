import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";

import {
  publishSyncEvents,
  syncTopic,
  type SyncPublisher,
} from "~/modules/sync/application/publish";

export async function publishWorkspaceUsageChanged(
  publisher: SyncPublisher,
  workspaceId: string,
  period: string,
): Promise<void> {
  if (!publisher.env?.DB || !publisher.env.USER_SYNC_COORDINATOR) {
    return;
  }

  try {
    const { results } = await publisher.env.DB.prepare(
      "SELECT user_id FROM resource_grant WHERE kind = 'membership' AND workspace_id = ? AND role IN ('owner', 'admin')",
    )
      .bind(workspaceId)
      .all<{ user_id: number }>();

    await publishSyncEvents(
      publisher.env,
      (results ?? []).map(({ user_id: userId }) => ({
        audience: [userId],
        topic: syncTopic("user", userId),
        type: "workspace_usage.changed",
        data: { workspaceId, period },
      })),
    );
  } catch (error) {
    getLogger({ prefix: "usage/workspace-events" }).error("Workspace usage notification failed", {
      error,
      workspaceId,
    });
  }
}

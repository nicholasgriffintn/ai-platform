import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";

import { workspaceAudience } from "~/modules/sync/application/audience";
import { publishSyncEvents, syncTopic } from "~/modules/sync/application/publish";
import type { IEnv } from "~/types";

export async function publishModelPlatformChanged(
  env: Pick<IEnv, "DB"> & Partial<Pick<IEnv, "USER_SYNC_COORDINATOR">>,
  workspaceId: string | undefined,
): Promise<void> {
  if (!workspaceId || !env.USER_SYNC_COORDINATOR) {
    return;
  }

  const syncEnv = { DB: env.DB, USER_SYNC_COORDINATOR: env.USER_SYNC_COORDINATOR };

  try {
    const audience = await workspaceAudience(syncEnv, workspaceId);

    await publishSyncEvents(
      syncEnv,
      audience.map((userId) => ({
        audience: [userId],
        topic: syncTopic("user", userId),
        type: "model_platform.changed",
        data: { workspaceId },
      })),
    );
  } catch (error) {
    getLogger({ prefix: "model-registry/sync" }).error("Model state notification failed", {
      error,
      workspaceId,
    });
  }
}

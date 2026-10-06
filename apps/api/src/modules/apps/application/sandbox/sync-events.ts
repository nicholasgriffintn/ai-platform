import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { SANDBOX_RUNS_CAPABILITY_ID } from "@ngriffin_uk/polychat-schemas";

import { projectAudience } from "~/modules/sync/application/audience";
import { publishSyncEvents, syncTopic, type SyncEnv } from "~/modules/sync/application/publish";

export async function publishSandboxRunChanged(env: SyncEnv, runId: string): Promise<void> {
  if (!env.USER_SYNC_COORDINATOR) {
    return;
  }

  try {
    const record = await env.DB.prepare(
      "SELECT project_id, conversation_id, created_by_user_id FROM activity_record WHERE capability_id = ? AND group_id = ? LIMIT 1",
    )
      .bind(SANDBOX_RUNS_CAPABILITY_ID, runId)
      .first<{
        project_id: string | null;
        conversation_id: string | null;
        created_by_user_id: number;
      }>();

    if (!record) {
      return;
    }

    const audience = record.project_id
      ? await projectAudience(env, record.project_id)
      : [record.created_by_user_id];

    await publishSyncEvents(
      env,
      audience.map((userId) => ({
        audience: [userId],
        topic: syncTopic("user", userId),
        type: "workbench_run.changed",
        data: { runId, projectId: record.project_id, conversationId: record.conversation_id },
      })),
    );
  } catch (error) {
    getLogger({ prefix: "sandbox/sync" }).error("Run notification failed", { error, runId });
  }
}

export function createSandboxSyncNotifier(
  env: SyncEnv,
  waitUntil: (work: Promise<unknown>) => void,
) {
  let scheduled = false;

  return (runId: string) => {
    if (scheduled || !env.USER_SYNC_COORDINATOR) {
      return;
    }

    scheduled = true;
    waitUntil(
      new Promise<void>((resolve) => setTimeout(resolve, 1_000)).then(() => {
        scheduled = false;

        return publishSandboxRunChanged(env, runId);
      }),
    );
  };
}

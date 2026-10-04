import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { SOURCE_KNOWLEDGE_SYNC_TASK_TYPE } from "@ngriffin_uk/polychat-schemas";

import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { TaskService } from "~/modules/tasks/application/TaskService";
import type { IEnv } from "~/types";

import type { KnowledgeSyncRecord } from "../infrastructure/KnowledgeSyncRepository";

export async function enqueueKnowledgeSync(
  env: IEnv,
  repositories: RepositoryManager,
  sync: KnowledgeSyncRecord,
) {
  try {
    await new TaskService(env, repositories.tasks).enqueueTask({
      id: `knowledge_sync_${sync.id}_${sync.generation}_${sync.cursor}`,
      task_type: SOURCE_KNOWLEDGE_SYNC_TASK_TYPE,
      user_id: sync.user_id,
      project_id: sync.project_id,
      task_data: { syncId: sync.id, generation: sync.generation },
    });
  } catch {
    getLogger({ prefix: "knowledge-sync" }).warn("Knowledge sync saved for queue recovery", {
      syncId: sync.id,
    });
  }
}

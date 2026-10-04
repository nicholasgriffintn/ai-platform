import { SOURCE_INDEX_TASK_TYPE } from "@ngriffin_uk/polychat-schemas";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import { SourceIndexRepository } from "~/modules/sources/infrastructure/SourceIndexRepository";
import { TaskService } from "~/modules/tasks/application/TaskService";
import type { IEnv } from "~/types";

import { removeSourceIndex } from "./knowledge-indexing";

export async function maintainKnowledgeIndexes(env: IEnv): Promise<void> {
  const context = createServiceContext({ env });
  const repository = new SourceIndexRepository(env);
  const tasks = new TaskService(env, context.repositories.tasks);

  for (const source of await repository.listPendingSources()) {
    await tasks.enqueueTask({
      id: `source_index_${source.id}_${source.revision}`,
      task_type: SOURCE_INDEX_TASK_TYPE,
      user_id: source.user_id,
      task_data: { sourceId: source.id, revision: source.revision },
      project_id: source.project_id ?? undefined,
    });
  }

  for (const index of await repository.listObsolete()) {
    try {
      await repository.deferCleanup(index.id);
      const task = await context.repositories.tasks.getTaskById(
        `source_index_${index.source_id}_${index.revision}`,
      );

      if (
        task &&
        (task.status === "running" ||
          (task.execution_lease_expires_at &&
            Date.parse(task.execution_lease_expires_at) > Date.now() - 60_000) ||
          (task.updated_at && Date.parse(task.updated_at) > Date.now() - 60_000))
      ) {
        continue;
      }

      const user = await context.repositories.users.getUserById(index.created_by_user_id);

      if (user) {
        await removeSourceIndex(createServiceContext({ env, user }), index);
      }
    } catch {
      context.getLogger().warn("Source index cleanup deferred", { indexId: index.id });
    }
  }
}

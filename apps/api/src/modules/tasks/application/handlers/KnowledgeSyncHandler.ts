import { repositoryKnowledgeSyncTaskDataSchema } from "@ngriffin_uk/polychat-schemas";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import { runKnowledgeSync } from "~/modules/sources/application/knowledge/sync";
import type { IEnv } from "~/types";

import type { TaskHandler, TaskMessage, TaskResult } from "../types";

export class KnowledgeSyncHandler implements TaskHandler {
  async handle(message: TaskMessage, env: IEnv): Promise<TaskResult> {
    const payload = repositoryKnowledgeSyncTaskDataSchema.parse(message.task_data);
    const context = createServiceContext({ env });
    const record = await context.repositories.repositoryKnowledgeSyncs.get(payload.syncId);

    if (!record || record.created_by_user_id !== message.user_id) {
      return { status: "success", message: "Knowledge connection is no longer active" };
    }

    const user = await context.repositories.users.getUserById(record.created_by_user_id);

    if (!user) {
      return { status: "success", message: "Knowledge connection owner is unavailable" };
    }

    await runKnowledgeSync(createServiceContext({ env, user }), payload.syncId);

    return { status: "success", message: "Knowledge sync progress saved" };
  }
}

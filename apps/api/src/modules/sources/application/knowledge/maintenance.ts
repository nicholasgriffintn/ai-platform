import { createServiceContext } from "~/infrastructure/context/serviceContext";
import type { IEnv } from "~/types";

import { enqueueKnowledgeSync } from "./connections";

export async function scheduleRepositoryKnowledgeSyncs(env: IEnv) {
  const context = createServiceContext({ env });
  const due = await context.repositories.repositoryKnowledgeSyncs.due();

  for (const record of due) {
    await enqueueKnowledgeSync(context, record.id, record.created_by_user_id);
  }
}

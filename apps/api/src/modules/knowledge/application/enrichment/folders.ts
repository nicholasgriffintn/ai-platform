import { readFolderReadAs, SOURCE_KNOWLEDGE_ENRICH_TASK_TYPE } from "@ngriffin_uk/polychat-schemas";
import { parseJsonRecord } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { KnowledgeDocumentRepository } from "~/modules/knowledge/infrastructure/KnowledgeDocumentRepository";
import { TaskService } from "~/modules/queue/application/TaskService";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";
import type { SourceCollectionRecord } from "~/modules/sources/infrastructure/SourceRepository";

import { readingEnricher } from "./reading";

export async function queueFolderReadings(
  context: ServiceContext,
  folder: Pick<SourceCollectionRecord, "project_id" | "settings">,
  sourceIds: readonly string[],
): Promise<void> {
  const readAs = readFolderReadAs(parseJsonRecord(folder.settings));

  if (!readAs || sourceIds.length === 0) {
    return;
  }

  await context.repositories.get(KnowledgeDocumentRepository).setReadAs(sourceIds, readAs);

  const tasks = new TaskService(context.env, new TaskRepository(context.env));
  const userId = context.requireUser().id;

  for (const sourceId of sourceIds) {
    await tasks.enqueueTask({
      task_type: SOURCE_KNOWLEDGE_ENRICH_TASK_TYPE,
      user_id: userId,
      project_id: folder.project_id ?? undefined,
      task_data: { sourceId, enricher: readingEnricher.name },
    });
  }
}

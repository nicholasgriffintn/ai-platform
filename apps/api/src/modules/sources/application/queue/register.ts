import {
  SOURCE_KNOWLEDGE_INDEX_TASK_TYPE,
  SOURCE_KNOWLEDGE_SYNC_TASK_TYPE,
} from "@ngriffin_uk/polychat-schemas";

import { defineSchedule, type AppWorkflows } from "~/modules/queue/application/workflows";
import { scheduleKnowledgeIndexes } from "~/modules/sources/application/knowledge-index";
import { scheduleKnowledgeSyncs } from "~/modules/sources/application/knowledge-sync-run";

import { sourceKnowledgeIndex } from "./source-knowledge";
import { sourceKnowledgeSync } from "./source-sync";

export function registerSourcesQueue(workflows: AppWorkflows): void {
  workflows.on(SOURCE_KNOWLEDGE_INDEX_TASK_TYPE, sourceKnowledgeIndex);
  workflows.on(SOURCE_KNOWLEDGE_SYNC_TASK_TYPE, sourceKnowledgeSync);

  workflows.always(
    defineSchedule({
      name: "source-knowledge-sync",
      run: async ({ env }) => {
        await scheduleKnowledgeSyncs(env);
      },
    }),
  );

  workflows.always(
    defineSchedule({
      name: "source-knowledge-index",
      run: async ({ env }) => {
        await scheduleKnowledgeIndexes(env);
      },
    }),
  );
}

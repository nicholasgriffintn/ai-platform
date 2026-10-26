import {
  SOURCE_KNOWLEDGE_INDEX_TASK_TYPE,
  SOURCE_KNOWLEDGE_SYNC_TASK_TYPE,
} from "@ngriffin_uk/polychat-schemas";

import { scheduleKnowledgeIndexes } from "~/modules/knowledge/application/index/indexing";
import { removeExpiredKnowledge } from "~/modules/knowledge/application/retention";
import { scheduleKnowledgeSyncs } from "~/modules/knowledge/application/syncs/run";
import { defineSchedule, type AppWorkflows } from "~/modules/queue/application/workflows";

import { knowledgeIndex } from "./knowledge-index";
import { knowledgeSync } from "./knowledge-sync";

export function registerKnowledgeQueue(workflows: AppWorkflows): void {
  workflows.on(SOURCE_KNOWLEDGE_INDEX_TASK_TYPE, knowledgeIndex);
  workflows.on(SOURCE_KNOWLEDGE_SYNC_TASK_TYPE, knowledgeSync);

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
      name: "knowledge-retention",
      run: async ({ env }) => {
        await removeExpiredKnowledge(env);
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

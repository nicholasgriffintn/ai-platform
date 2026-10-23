import {
  SOURCE_GENERATION_POLLING_TASK_TYPE,
  SOURCE_KNOWLEDGE_INDEX_TASK_TYPE,
  SOURCE_KNOWLEDGE_SYNC_TASK_TYPE,
  SOURCE_MEDIA_TRANSCRIPTION_TASK_TYPE,
  SOURCE_PODCAST_GENERATION_TASK_TYPE,
} from "@ngriffin_uk/polychat-schemas";

import { defineSchedule, type AppWorkflows } from "~/modules/queue/application/workflows";
import { scheduleKnowledgeIndexes } from "~/modules/sources/application/knowledge-index";
import { scheduleKnowledgeSyncs } from "~/modules/sources/application/knowledge-sync-run";

import { sourceGenerationPolling } from "./source-generation-polling";
import { sourceKnowledgeIndex } from "./source-knowledge";
import { sourceMediaTranscription } from "./source-media-transcription";
import { sourcePodcastGeneration } from "./source-podcast";
import { sourceKnowledgeSync } from "./source-sync";

export function registerSourcesQueue(workflows: AppWorkflows): void {
  workflows.on(SOURCE_KNOWLEDGE_INDEX_TASK_TYPE, sourceKnowledgeIndex);
  workflows.on(SOURCE_KNOWLEDGE_SYNC_TASK_TYPE, sourceKnowledgeSync);
  workflows.on(SOURCE_MEDIA_TRANSCRIPTION_TASK_TYPE, sourceMediaTranscription);
  workflows.on(SOURCE_PODCAST_GENERATION_TASK_TYPE, sourcePodcastGeneration);
  workflows.poll(SOURCE_GENERATION_POLLING_TASK_TYPE, sourceGenerationPolling);

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

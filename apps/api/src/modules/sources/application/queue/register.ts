import {
  SOURCE_GENERATION_POLLING_TASK_TYPE,
  SOURCE_LISTEN_TASK_TYPE,
  SOURCE_MEDIA_TRANSCRIPTION_TASK_TYPE,
  SOURCE_PODCAST_GENERATION_TASK_TYPE,
} from "@ngriffin_uk/polychat-schemas";

import type { AppWorkflows } from "~/modules/queue/application/workflows";

import { sourceGenerationPolling } from "./source-generation-polling";
import { sourceListen } from "./source-listen";
import { sourceMediaTranscription } from "./source-media-transcription";
import { sourcePodcastGeneration } from "./source-podcast";

export function registerSourcesQueue(workflows: AppWorkflows): void {
  workflows.on(SOURCE_MEDIA_TRANSCRIPTION_TASK_TYPE, sourceMediaTranscription);
  workflows.on(SOURCE_PODCAST_GENERATION_TASK_TYPE, sourcePodcastGeneration);
  workflows.on(SOURCE_LISTEN_TASK_TYPE, sourceListen);
  workflows.poll(SOURCE_GENERATION_POLLING_TASK_TYPE, sourceGenerationPolling);
}

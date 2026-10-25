import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  formatTranscriptText,
  podcastFormatSchema,
  podcastLengthSchema,
  SOURCE_PODCAST_GENERATION_TASK_TYPE,
  type GeneratePodcastInput,
  type Source,
  type SourceGeneration,
  type SourceTranscript,
} from "@ngriffin_uk/polychat-schemas";
import {
  AssistantError,
  ErrorType,
  getErrorMessage,
} from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { StorageService } from "~/infrastructure/storage";
import { assertPlanEntitlement } from "~/middleware/requirePlan";
import { TaskService } from "~/modules/queue/application/TaskService";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";
import { buildSourceMaterial } from "~/modules/sources/application/material";
import { storeSourceCover } from "~/modules/sources/application/media/cover";
import {
  publishSourceChanged,
  readSourceRecordGeneration,
  updateSourceRecord,
} from "~/modules/sources/application/media/metadata";
import {
  addCollectionSources,
  createSource,
  requireCollectionAccess,
  requireSourcesAccess,
} from "~/modules/sources/application/sources";
import {
  SourceRepository,
  type SourceRecord,
} from "~/modules/sources/infrastructure/SourceRepository";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

import { estimateSpokenSeconds, PODCAST_HOSTS, synthesisePodcastAudio } from "./audio";
import { writePodcastScript } from "./script";

const logger = getLogger({ prefix: "sources/podcasts" });

export async function startPodcastGeneration(
  context: ServiceContext,
  input: GeneratePodcastInput,
): Promise<Source> {
  const user = context.requireUser();
  const projectId = input.projectId ?? null;

  assertPlanEntitlement(user, "pro");

  if (projectId) {
    await requireProjectAccess(context, projectId);
  }

  const show = input.showId
    ? await requireCollectionAccess(context, user.id, input.showId, true)
    : null;

  if (show && (show.kind !== "podcast" || show.project_id !== projectId)) {
    throw new AssistantError(
      "Choose a show in the same place as the episode",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const chosenSources = await requireSourcesAccess(context, user.id, input.sourceIds, (source) => {
    if (source.project_id !== projectId) {
      throw new AssistantError(
        "Sources must belong to the episode's scope",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }
  });

  if (!input.material && !buildSourceMaterial(chosenSources)) {
    throw new AssistantError(
      "The chosen sources have no text to talk about. Transcribe or add text first.",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const material = input.material
    ? await createSource(context, user.id, {
        projectId,
        kind: "text",
        title: `${input.title ?? "Episode"} research`,
        status: "available",
        content: input.material,
        metadata: {},
      })
    : null;
  const sourceIds = material ? [...input.sourceIds, material.id] : [...input.sourceIds];

  const episode = await createSource(context, user.id, {
    projectId,
    kind: "podcast",
    title: input.title ?? "New episode",
    status: "processing",
    metadata: {
      generation: {
        type: "podcast",
        mode: "audio",
        prompt: input.focus,
        sourceIds,
        input: { format: input.format, length: input.length, language: input.language },
      } satisfies SourceGeneration,
    },
  });

  if (show) {
    await addCollectionSources(
      context,
      user.id,
      show.id,
      material ? [episode.id, material.id] : [episode.id],
    );
  }

  await new TaskService(context.env, new TaskRepository(context.env)).enqueueTask({
    task_type: SOURCE_PODCAST_GENERATION_TASK_TYPE,
    user_id: user.id,
    project_id: projectId ?? undefined,
    task_data: { sourceId: episode.id, runId: context.executionRunId },
    priority: 6,
  });

  return episode;
}

async function produceEpisode(
  context: ServiceContext,
  episode: SourceRecord,
  generation: SourceGeneration,
): Promise<SourceRecord> {
  const user = context.requireUser();
  const sources = await requireSourcesAccess(context, user.id, generation.sourceIds ?? []);
  const language =
    typeof generation.input?.language === "string" ? generation.input.language : "en";
  const script = await writePodcastScript(context, {
    sources,
    format: podcastFormatSchema.catch("deep_dive").parse(generation.input?.format),
    length: podcastLengthSchema.catch("default").parse(generation.input?.length),
    language,
    focus: generation.prompt,
  });
  const { audio, turnStarts, durationSeconds } = await synthesisePodcastAudio(
    context,
    script.turns,
    language,
  );
  const key = `sources/${episode.id}/episode.mp3`;
  const transcript: SourceTranscript = {
    status: "ready",
    speakers: { host: PODCAST_HOSTS.host.name, guest: PODCAST_HOSTS.guest.name },
    segments: script.turns.map((turn, index) => ({
      speaker: turn.speaker,
      text: turn.text,
      start: Math.round((turnStarts[index] ?? 0) * 100) / 100,
    })),
  };

  await StorageService.forPrivateAssets(context).uploadObject(key, audio, {
    httpMetadata: { contentType: "audio/mpeg" },
  });

  const titled = await updateSourceRecord(context, episode, {
    title: episode.title === "New episode" ? script.title.slice(0, 200) : episode.title,
    content: formatTranscriptText(transcript),
    media: {
      transcript,
      notes: { summary: script.description, decisions: [], actionItems: [] },
      durationSeconds:
        durationSeconds > 0 ? Math.round(durationSeconds) : estimateSpokenSeconds(script.turns),
    },
  });
  const repository = context.repositories.get(SourceRepository);

  await repository.attachSourceFile(
    titled.id,
    {
      storageKey: key,
      mimeType: "audio/mpeg",
      filename: "episode.mp3",
      byteSize: audio.byteLength,
    },
    { status: "available" },
  );

  const stored = await repository.getSource(titled.id);

  if (!stored) {
    throw new AssistantError("Source not found", ErrorType.NOT_FOUND, 404);
  }

  await publishSourceChanged(context, stored);

  try {
    return await storeSourceCover(context, stored, script.description);
  } catch (error) {
    logger.warn("Podcast cover was not generated", { sourceId: stored.id, error });

    return stored;
  }
}

/** Writes the script, voices it and stores the episode. Runs on the queue. */
export async function runPodcastGeneration(
  context: ServiceContext,
  sourceId: string,
): Promise<SourceRecord | null> {
  const episode = await context.repositories.get(SourceRepository).getSource(sourceId);
  const generation = episode ? readSourceRecordGeneration(episode) : null;

  if (!episode || episode.kind !== "podcast" || episode.status !== "processing" || !generation) {
    return null;
  }

  try {
    return await produceEpisode(context, episode, generation);
  } catch (error) {
    logger.error("Podcast generation failed", { sourceId, error });

    return updateSourceRecord(context, episode, {
      status: "failed",
      generation: { error: getErrorMessage(error, "Podcast generation failed") },
    });
  }
}

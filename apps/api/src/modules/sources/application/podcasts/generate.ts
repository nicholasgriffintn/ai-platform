import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { TaskSteps } from "@ngriffin_uk/polychat-ai-workflows";
import {
  formatTranscriptText,
  podcastFormatSchema,
  podcastLengthSchema,
  podcastScriptSchema,
  sourceGenerationSchema,
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
import { z } from "zod/v4";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { StorageService } from "~/infrastructure/storage";
import { assertPlanEntitlement } from "~/middleware/requirePlan";
import { estimateSpokenSeconds } from "~/modules/audio/domain/speech-text";
import { withKnowledgeText } from "~/modules/knowledge/application/intake/body";
import { fileKnowledgeSource } from "~/modules/knowledge/application/intake/file";
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
  requireCollectionAccess,
  requireSourcesAccess,
  requireSourceAccess,
  formatSource,
} from "~/modules/sources/application/sources";
import {
  SourceRepository,
  type SourceRecord,
} from "~/modules/sources/infrastructure/SourceRepository";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

import { PODCAST_HOSTS, synthesisePodcastAudio } from "./audio";
import { writePodcastScript } from "./script";

const logger = getLogger({ prefix: "sources/podcasts" });
const podcastRecordingSchema = z.object({
  turnStarts: z.array(z.number()),
  durationSeconds: z.number(),
  byteSize: z.number(),
});

export async function preparePodcastGeneration(
  context: ServiceContext,
  input: GeneratePodcastInput,
  options: { sourceId?: string } = {},
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

  const existing = options.sourceId
    ? await context.repositories.get(SourceRepository).getSource(options.sourceId)
    : null;

  if (existing) {
    const owned = await requireSourceAccess(context, user.id, existing.id, true);

    if (owned.kind !== "podcast" || owned.project_id !== projectId) {
      throw new AssistantError("That episode belongs to another scope", ErrorType.FORBIDDEN, 403);
    }

    return formatSource(owned);
  }

  const accessible = await requireSourcesAccess(context, user.id, input.sourceIds, (source) => {
    if (source.project_id !== projectId) {
      throw new AssistantError(
        "Sources must belong to the episode's scope",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }
  });
  const chosenSources = await withKnowledgeText(context, accessible);

  if (!input.material && !buildSourceMaterial(chosenSources)) {
    throw new AssistantError(
      "The chosen sources have no text to talk about. Transcribe or add text first.",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const material = input.material
    ? await fileKnowledgeSource(context, {
        id: options.sourceId ? `${options.sourceId}_research` : undefined,
        origin: "note",
        projectId,
        kind: "text",
        title: `${input.title ?? "Episode"} research`,
        provider: null,
        content: input.material,
      })
    : null;
  const sourceIds = material ? [...input.sourceIds, material.id] : [...input.sourceIds];

  const episode = await fileKnowledgeSource(context, {
    id: options.sourceId,
    origin: "generated",
    projectId,
    provider: null,
    content: undefined,
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

  return episode;
}

export async function startPodcastGeneration(
  context: ServiceContext,
  input: GeneratePodcastInput,
  options: { sourceId?: string } = {},
): Promise<Source> {
  const episode = await preparePodcastGeneration(context, input, options);
  const user = context.requireUser();
  const projectId = input.projectId ?? null;

  if (episode.status === "processing") {
    await new TaskService(context.env, new TaskRepository(context.env)).enqueueTask({
      id: options.sourceId ? `podcast_${episode.id}` : undefined,
      task_type: SOURCE_PODCAST_GENERATION_TASK_TYPE,
      user_id: user.id,
      project_id: projectId ?? undefined,
      task_data: {
        sourceId: episode.id,
        runId: context.executionRunId,
      },
      priority: 6,
    });
  }

  return episode;
}

async function requireEpisode(context: ServiceContext, sourceId: string): Promise<SourceRecord> {
  const episode = await context.repositories.get(SourceRepository).getSource(sourceId);

  if (!episode) {
    throw new AssistantError("Source not found", ErrorType.NOT_FOUND, 404);
  }

  return episode;
}

async function produceEpisode(
  context: ServiceContext,
  sourceId: string,
  generation: SourceGeneration,
  steps: TaskSteps,
  assertCurrent: () => Promise<void>,
): Promise<void> {
  const user = context.requireUser();
  const language =
    typeof generation.input?.language === "string" ? generation.input.language : "en";
  const key = `sources/${sourceId}/episode.mp3`;
  const script = await steps.value("script", podcastScriptSchema, async () => {
    await assertCurrent();

    return writePodcastScript(context, {
      sources: await withKnowledgeText(
        context,
        await requireSourcesAccess(context, user.id, generation.sourceIds ?? []),
      ),
      format: podcastFormatSchema.catch("deep_dive").parse(generation.input?.format),
      length: podcastLengthSchema.catch("default").parse(generation.input?.length),
      language,
      focus: generation.prompt,
    });
  });
  const recording = await steps.value("voice", podcastRecordingSchema, async () => {
    await assertCurrent();
    const { audio, turnStarts, durationSeconds } = await synthesisePodcastAudio(
      context,
      script.turns,
      language,
    );

    const stored = await StorageService.forPrivateAssets(context).uploadGeneratedMedia(key, audio, {
      mimeType: "audio/mpeg",
    });

    return { turnStarts, durationSeconds, byteSize: stored.byteLength };
  });

  await steps.run("store", async () => {
    const episode = await requireEpisode(context, sourceId);
    const transcript: SourceTranscript = {
      status: "ready",
      speakers: { host: PODCAST_HOSTS.host.name, guest: PODCAST_HOSTS.guest.name },
      segments: script.turns.map((turn, index) => ({
        speaker: turn.speaker,
        text: turn.text,
        start: Math.round((recording.turnStarts[index] ?? 0) * 100) / 100,
      })),
    };
    const titled = await updateSourceRecord(context, episode, {
      title: episode.title === "New episode" ? script.title.slice(0, 200) : episode.title,
      content: formatTranscriptText(transcript),
      media: {
        transcript,
        notes: { summary: script.description, decisions: [], actionItems: [] },
        durationSeconds:
          recording.durationSeconds > 0
            ? Math.round(recording.durationSeconds)
            : estimateSpokenSeconds(script.turns.map((turn) => turn.text)),
      },
    });
    const repository = context.repositories.get(SourceRepository);

    await repository.attachSourceFile(
      titled.id,
      {
        storageKey: key,
        mimeType: "audio/mpeg",
        filename: "episode.mp3",
        byteSize: recording.byteSize,
      },
      { status: "available" },
    );
    await publishSourceChanged(context, await requireEpisode(context, sourceId));
  });

  try {
    await steps.run("cover", async () => {
      await assertCurrent();
      await storeSourceCover(context, await requireEpisode(context, sourceId), script.description);
    });
  } catch (error) {
    logger.error("Podcast cover was not generated", { sourceId, error });
  }
}

export async function runPodcastGeneration(
  context: ServiceContext,
  sourceId: string,
  steps: TaskSteps,
  assertCurrent: () => Promise<void> = async () => {},
): Promise<"ready" | "failed" | "skipped"> {
  await requireSourceAccess(context, context.requireUser().id, sourceId, true);
  const generation = await steps.value("load", sourceGenerationSchema.nullable(), async () => {
    const episode = await context.repositories.get(SourceRepository).getSource(sourceId);

    return episode?.kind === "podcast" && episode.status === "processing"
      ? readSourceRecordGeneration(episode)
      : null;
  });

  if (!generation) {
    return "skipped";
  }

  try {
    await assertCurrent();
    await produceEpisode(context, sourceId, generation, steps, assertCurrent);

    return "ready";
  } catch (error) {
    logger.error("Podcast generation failed", { sourceId, error });
    await steps.run("failed", async () => {
      await updateSourceRecord(context, await requireEpisode(context, sourceId), {
        status: "failed",
        generation: { error: getErrorMessage(error, "Podcast generation failed") },
      });
    });

    return "failed";
  }
}

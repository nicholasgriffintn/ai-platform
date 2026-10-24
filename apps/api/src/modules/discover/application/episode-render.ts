import { renderPrompt } from "@ngriffin_uk/polychat-ai-prompts";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  discoverChapterCheckSchema,
  discoverChapterScriptDraftSchema,
  type DiscoverEpisodeChapter,
  type DiscoverEpisodeContent,
} from "@ngriffin_uk/polychat-schemas";
import { mapWithConcurrency } from "@ngriffin_uk/polychat-utility-server/async";
import {
  AssistantError,
  ErrorType,
  getErrorMessage,
} from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { StorageService } from "~/infrastructure/storage";
import { getPrivateFileResponse } from "~/infrastructure/storage/read-resource";
import { synthesiseSpeech } from "~/modules/audio/application/speech";
import { resolveSpeechVoice } from "~/modules/audio/application/speech-voice";
import {
  chapterAudioKey,
  chapterWordTarget,
  describeChapterBrief,
  describeSeasonPlan,
  shotImageKey,
  wordsForMinutes,
} from "~/modules/discover/domain/episodes";
import { generateStudioImage } from "~/modules/notebooks/application/studio/images";
import { timeScenes } from "~/modules/notebooks/application/studio/video";
import { VIDEO_STYLE_PROMPTS } from "~/modules/notebooks/domain/studio-guidance";
import { OutputRepository } from "~/modules/outputs/infrastructure/OutputRepository";
import {
  estimateSpokenSeconds,
  joinAudioSegments,
  splitForSpeech,
} from "~/modules/sources/application/podcasts/audio";
import { UserSettingsRepository } from "~/modules/user/infrastructure/UserSettingsRepository";

import { enqueueDiscoverJob } from "./covers";
import { requireDiscoverEdition, withEditionRun } from "./editions";
import { loadEpisodeMaterial, requireDiscoverEpisode, requireDiscoverSeason } from "./episodes";
import { publishDiscoverChanged } from "./events";
import { generateDiscoverObject } from "./generate";

const logger = getLogger({ prefix: "discover/episodes" });
const SHOT_CONCURRENCY = 3;
const SHOT_BATCH = 6;
const GROUNDING_REWRITES = 1;
const SHOT_WIDTH = 1280;
const SHOT_HEIGHT = 720;
const SAVE_ATTEMPTS = 5;

interface ShotJob {
  key: string;
  visual: string;
  scene: number;
  shot: number;
}

async function illustrate(context: ServiceContext, style: string, job: ShotJob): Promise<boolean> {
  const storage = StorageService.forPrivateAssets(context);

  if (await storage.headObject(job.key)) {
    return true;
  }

  try {
    const image = await generateStudioImage(context, {
      completionId: job.key.replaceAll("/", "-"),
      prompt: `${style}. ${job.visual}. No text, letters, numbers or logos anywhere in the picture.`,
      aspectRatio: "16:9",
      width: SHOT_WIDTH,
      height: SHOT_HEIGHT,
    });

    if (!image) {
      return false;
    }

    await storage.uploadObject(job.key, await image.arrayBuffer(), {
      httpMetadata: { contentType: image.type || "image/png" },
    });

    return true;
  } catch (error) {
    logger.warn("Episode shot failed", { key: job.key, error_message: getErrorMessage(error) });

    return false;
  }
}

async function narrateChapter(
  context: ServiceContext,
  episodeId: string,
  chapterIndex: number,
  chapter: DiscoverEpisodeChapter,
) {
  const user = context.requireUser();
  const narrator = await resolveSpeechVoice(context.env, user, {
    role: "narrator",
    settings: await new UserSettingsRepository(context.env).getUserSettings(user.id),
  });
  const segments: Uint8Array[] = [];

  for (const scene of chapter.scenes) {
    const pieces: Uint8Array[] = [];

    for (const text of splitForSpeech(scene.narration)) {
      pieces.push(await synthesiseSpeech(context, narrator, text, "en"));
    }

    segments.push(joinAudioSegments(pieces));
  }

  const audio = joinAudioSegments(segments);

  await StorageService.forPrivateAssets(context).uploadObject(
    chapterAudioKey(episodeId, chapterIndex),
    audio,
    { httpMetadata: { contentType: "audio/mpeg" } },
  );

  return timeScenes(
    segments.map((segment) => segment.byteLength),
    estimateSpokenSeconds(
      chapter.scenes.map((scene) => ({ speaker: "host" as const, text: scene.narration })),
    ),
  );
}

async function saveChapter(
  context: ServiceContext,
  episodeId: string,
  chapterIndex: number,
  update: (chapter: DiscoverEpisodeChapter) => DiscoverEpisodeChapter,
) {
  const user = context.requireUser();
  const outputs = context.repositories.get(OutputRepository);

  for (let attempt = 0; attempt < SAVE_ATTEMPTS; attempt += 1) {
    const { record, content } = await requireDiscoverEpisode(context, episodeId);
    const chapters = content.chapters.map((chapter, index) =>
      index === chapterIndex ? update(chapter) : chapter,
    );
    const finished = chapters.every(
      (chapter) => chapter.status === "ready" || chapter.status === "failed",
    );
    const completed =
      record.status !== "ready" && chapters.every((chapter) => chapter.status === "ready");

    try {
      await outputs.updateOutput(episodeId, {
        content: { ...content, chapters },
        status: finished ? "ready" : "pending",
        expectedRevision: record.revision,
        updatedByUserId: user.id,
      });
      await publishDiscoverChanged(context);

      if (completed && content.notebookId) {
        await enqueueDiscoverJob(context, { job: "episode_extras", episodeId });
      }

      return;
    } catch (error) {
      if (!(error instanceof AssistantError) || error.type !== ErrorType.CONFLICT_ERROR) {
        throw error;
      }
    }
  }

  throw new AssistantError("The episode kept changing while saving", ErrorType.CONFLICT_ERROR);
}

async function scriptChapter(
  context: ServiceContext,
  content: DiscoverEpisodeContent,
  chapterIndex: number,
): Promise<DiscoverEpisodeChapter["scenes"]> {
  const chapter = content.chapters[chapterIndex];
  const [material, season] = await Promise.all([
    loadEpisodeMaterial(context, content),
    requireDiscoverSeason(context, content.seasonId),
  ]);
  const system = renderPrompt("discover/episode/chapter", {
    topic: content.topic,
    chapter: describeChapterBrief(chapter),
    position: `${chapterIndex + 1} of ${content.chapters.length}`,
    words: String(chapterWordTarget(wordsForMinutes(content.minutes), content.chapters.length)),
    plan: describeSeasonPlan(season),
  });
  let draft = await generateDiscoverObject(context, {
    name: "discover_episode_chapter",
    schema: discoverChapterScriptDraftSchema,
    system,
    material,
  });

  for (let attempt = 0; attempt < GROUNDING_REWRITES; attempt += 1) {
    const check = await generateDiscoverObject(context, {
      name: "discover_episode_check",
      schema: discoverChapterCheckSchema,
      system: renderPrompt("discover/episode/check"),
      material: `# Material\n\n${material}\n\n# Narration\n\n${draft.scenes
        .map((scene) => scene.narration)
        .join("\n\n")}`,
    });

    if (check.unsupported.length === 0) {
      break;
    }

    draft = await generateDiscoverObject(context, {
      name: "discover_episode_chapter",
      schema: discoverChapterScriptDraftSchema,
      system: `${system}\n\nAn earlier draft made claims the material does not support. Leave these out or say plainly that the material does not cover them:\n${check.unsupported
        .map((claim) => `- ${claim}`)
        .join("\n")}`,
      material,
    });
  }

  return draft.scenes.map((scene) => ({
    ...scene,
    shots: scene.shots.map((shot) => ({ ...shot, image: false })),
  }));
}

export async function renderEpisodeChapter(
  context: ServiceContext,
  episodeId: string,
  chapterIndex: number,
): Promise<void> {
  const { content } = await requireDiscoverEpisode(context, episodeId);
  const chapter = content.chapters[chapterIndex];

  if (!chapter || chapter.status === "ready") {
    return;
  }

  try {
    await saveChapter(context, episodeId, chapterIndex, (current) => ({
      ...current,
      status: "scripting",
    }));
    const scenes = await scriptChapter(context, content, chapterIndex);
    const scripted = { ...chapter, scenes };

    await saveChapter(context, episodeId, chapterIndex, (current) => ({
      ...current,
      scenes,
      status: "rendering",
    }));

    const timings = await narrateChapter(context, episodeId, chapterIndex, scripted);

    await saveChapter(context, episodeId, chapterIndex, (current) => ({
      ...current,
      timings,
      status: "ready",
    }));

    const style = VIDEO_STYLE_PROMPTS[content.style];
    const jobs: ShotJob[] = scenes.flatMap((scene, sceneIndex) =>
      scene.shots.map((shot, shotIndex) => ({
        key: shotImageKey(episodeId, content.seasonId, {
          chapter: chapterIndex,
          scene: sceneIndex,
          shot: shotIndex,
          plate: shot.plate,
        }),
        visual: shot.visual,
        scene: sceneIndex,
        shot: shotIndex,
      })),
    );

    for (let start = 0; start < jobs.length; start += SHOT_BATCH) {
      const batch = jobs.slice(start, start + SHOT_BATCH);
      const drawn = await mapWithConcurrency(batch, SHOT_CONCURRENCY, async (job) =>
        (await illustrate(context, style, job)) ? `${job.scene}:${job.shot}` : null,
      );
      const ready = new Set(drawn.filter((key): key is string => key !== null));

      if (ready.size > 0) {
        await saveChapter(context, episodeId, chapterIndex, (current) => ({
          ...current,
          scenes: current.scenes.map((scene, sceneIndex) => ({
            ...scene,
            shots: scene.shots.map((shot, shotIndex) => ({
              ...shot,
              image: shot.image || ready.has(`${sceneIndex}:${shotIndex}`),
            })),
          })),
        }));
      }
    }
  } catch (error) {
    logger.error("Episode chapter failed", {
      episodeId,
      chapterIndex,
      error_message: getErrorMessage(error),
    });
    await saveChapter(context, episodeId, chapterIndex, (current) =>
      current.status === "ready" ? current : { ...current, status: "failed" },
    );
  }
}

export async function retryEpisodeChapter(
  context: ServiceContext,
  episodeId: string,
  chapterIndex: number,
): Promise<{ queued: true }> {
  const { content } = await requireDiscoverEpisode(context, episodeId);

  if (content.chapters[chapterIndex]?.status !== "failed") {
    throw new AssistantError("Only a failed chapter can be retried", ErrorType.CONFLICT_ERROR, 409);
  }

  await saveChapter(context, episodeId, chapterIndex, (current) => ({
    ...current,
    status: "pending",
  }));
  const edition = await requireDiscoverEdition(
    context,
    context.requireUser().id,
    content.editionId,
  );

  await enqueueDiscoverJob(withEditionRun(context, edition), {
    job: "episode_chapter",
    episodeId,
    chapter: chapterIndex,
  });

  return { queued: true };
}

async function readEpisodeFile(
  context: ServiceContext,
  key: string,
  filename: string,
  fallbackType: string,
  rangeHeader?: string | null,
): Promise<Response> {
  const object = await StorageService.forPrivateAssets(context).getObjectBody(key);

  if (!object) {
    throw new AssistantError("Not ready yet", ErrorType.NOT_FOUND, 404);
  }

  return getPrivateFileResponse(
    { mime_type: object.httpMetadata?.contentType ?? fallbackType, filename },
    object,
    rangeHeader,
  );
}

export async function readEpisodeChapterAudio(
  context: ServiceContext,
  episodeId: string,
  chapterIndex: number,
  rangeHeader?: string | null,
) {
  await requireDiscoverEpisode(context, episodeId);

  return readEpisodeFile(
    context,
    chapterAudioKey(episodeId, chapterIndex),
    `chapter-${chapterIndex + 1}.mp3`,
    "audio/mpeg",
    rangeHeader,
  );
}

export async function readEpisodeShot(
  context: ServiceContext,
  episodeId: string,
  location: { chapter: number; scene: number; shot: number },
) {
  const { content } = await requireDiscoverEpisode(context, episodeId);
  const shot = content.chapters[location.chapter]?.scenes[location.scene]?.shots[location.shot];

  if (!shot) {
    throw new AssistantError("Shot not found", ErrorType.NOT_FOUND, 404);
  }

  return readEpisodeFile(
    context,
    shotImageKey(episodeId, content.seasonId, { ...location, plate: shot.plate }),
    "shot",
    "image/png",
  );
}

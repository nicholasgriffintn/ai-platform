import { renderPrompt } from "@ngriffin_uk/polychat-ai-prompts";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { TaskSteps } from "@ngriffin_uk/polychat-ai-workflows";
import {
  discoverChapterCheckSchema,
  discoverChapterScriptDraftSchema,
  type DiscoverEpisodeChapter,
  type DiscoverEpisodeContent,
  type NarrationVoice,
} from "@ngriffin_uk/polychat-schemas";
import { mapWithConcurrency } from "@ngriffin_uk/polychat-utility-server/async";
import {
  AssistantError,
  ErrorType,
  getErrorMessage,
} from "@ngriffin_uk/polychat-utility-server/errors";
import { z } from "zod/v4";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { StorageService } from "~/infrastructure/storage";
import {
  getPrivateObjectResponse,
  IMMUTABLE_PRIVATE_CACHE_CONTROL,
} from "~/infrastructure/storage/read-resource";
import { narratePassages } from "~/modules/audio/application/narration";
import {
  chapterAudioKey,
  chapterWordTarget,
  describeChapterBrief,
  describeEarlierChapters,
  describeLaterChapters,
  describeSeasonPlan,
  shotImageKey,
  wordsForMinutes,
} from "~/modules/discover/domain/episodes";
import { storeDrawnImage, TEXTLESS_PICTURE } from "~/modules/generate/application/stored-image";
import { generateSystemObject } from "~/modules/models/application/system-object";
import { VIDEO_STYLE_PROMPTS } from "~/modules/notebooks/domain/studio-guidance";
import { OutputRepository } from "~/modules/outputs/infrastructure/OutputRepository";

import { requireDiscoverEdition, withEditionRun } from "./editions";
import { makeEpisodeStudySet } from "./episode-extras";
import { loadEpisodeMaterial, requireDiscoverEpisode, requireDiscoverSeason } from "./episodes";
import { publishDiscoverChanged } from "./events";
import { enqueueDiscoverJob } from "./jobs";

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

async function narrateChapter(
  context: ServiceContext,
  episodeId: string,
  chapterIndex: number,
  chapter: DiscoverEpisodeChapter,
  pinned: NarrationVoice | undefined,
) {
  const { audio, timings } = await narratePassages(
    context,
    chapter.scenes.map((scene) => scene.narration),
    {
      language: "en",
      voice: pinned,
      onVoice: async (voice) => {
        if (voice.model !== pinned?.model || voice.voice !== pinned.voice) {
          await saveEpisode(context, episodeId, (content) => ({ ...content, voice }));
        }
      },
    },
  );

  await StorageService.forPrivateAssets(context).uploadObject(
    chapterAudioKey(episodeId, chapterIndex),
    audio,
    { httpMetadata: { contentType: "audio/mpeg" } },
  );

  return timings;
}

function saveChapter(
  context: ServiceContext,
  episodeId: string,
  chapterIndex: number,
  update: (chapter: DiscoverEpisodeChapter) => DiscoverEpisodeChapter,
) {
  return saveEpisode(context, episodeId, (content) => ({
    ...content,
    chapters: content.chapters.map((chapter, index) =>
      index === chapterIndex ? update(chapter) : chapter,
    ),
  }));
}

async function saveEpisode(
  context: ServiceContext,
  episodeId: string,
  update: (content: DiscoverEpisodeContent) => DiscoverEpisodeContent,
) {
  const user = context.requireUser();
  const outputs = context.repositories.get(OutputRepository);

  for (let attempt = 0; attempt < SAVE_ATTEMPTS; attempt += 1) {
    const { record, content } = await requireDiscoverEpisode(context, episodeId);
    const updated = update(content);
    const { chapters } = updated;
    const finished = chapters.every(
      (chapter) => chapter.status === "ready" || chapter.status === "failed",
    );

    try {
      await outputs.updateOutput(episodeId, {
        content: updated,
        status: finished ? "ready" : "pending",
        expectedRevision: record.revision,
        updatedByUserId: user.id,
      });
      await publishDiscoverChanged(context);

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
    earlier: describeEarlierChapters(content.chapters, chapterIndex),
    later: describeLaterChapters(content.chapters, chapterIndex),
  });
  let draft = await generateSystemObject(context, {
    role: "writing",
    name: "discover_episode_chapter",
    requiresReasoning: false,
    schema: discoverChapterScriptDraftSchema,
    system,
    material,
  });

  for (let attempt = 0; attempt < GROUNDING_REWRITES; attempt += 1) {
    const check = await generateSystemObject(context, {
      role: "writing",
      name: "discover_episode_check",
      requiresReasoning: true,
      schema: discoverChapterCheckSchema,
      system: renderPrompt("discover/episode/check"),
      material: `# Material\n\n${material}\n\n# Narration\n\n${draft.scenes
        .map((scene) => scene.narration)
        .join("\n\n")}`,
    });

    if (check.unsupported.length === 0) {
      break;
    }

    draft = await generateSystemObject(context, {
      role: "writing",
      name: "discover_episode_chapter",
      requiresReasoning: false,
      schema: discoverChapterScriptDraftSchema,
      system: `${system}\n\nAn earlier draft made claims the material does not support. Leave them out entirely, without mentioning that anything is missing:\n${check.unsupported
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

function shouldRenderChapter(chapter: DiscoverEpisodeChapter | undefined): boolean {
  return Boolean(chapter) && chapter?.status !== "ready" && chapter?.status !== "failed";
}

async function scriptEpisodeChapter(
  context: ServiceContext,
  episodeId: string,
  chapterIndex: number,
): Promise<boolean> {
  const { content } = await requireDiscoverEpisode(context, episodeId);

  if (!shouldRenderChapter(content.chapters[chapterIndex])) {
    return false;
  }

  await saveChapter(context, episodeId, chapterIndex, (current) => ({
    ...current,
    status: "scripting",
  }));
  const scenes = await scriptChapter(context, content, chapterIndex);

  await saveChapter(context, episodeId, chapterIndex, (current) => ({
    ...current,
    scenes,
    status: "rendering",
  }));

  return true;
}

async function narrateEpisodeChapter(
  context: ServiceContext,
  episodeId: string,
  chapterIndex: number,
): Promise<void> {
  const { content } = await requireDiscoverEpisode(context, episodeId);
  const timings = await narrateChapter(
    context,
    episodeId,
    chapterIndex,
    content.chapters[chapterIndex],
    content.voice,
  );

  await saveChapter(context, episodeId, chapterIndex, (current) => ({
    ...current,
    timings,
    status: "ready",
  }));
}

function chapterShotJobs(
  episodeId: string,
  content: DiscoverEpisodeContent,
  chapterIndex: number,
): ShotJob[] {
  return content.chapters[chapterIndex].scenes.flatMap((scene, sceneIndex) =>
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
}

async function drawChapterShots(
  context: ServiceContext,
  episodeId: string,
  chapterIndex: number,
  style: string,
  batch: readonly ShotJob[],
): Promise<void> {
  const drawn = await mapWithConcurrency(batch, SHOT_CONCURRENCY, async (job) =>
    (await storeDrawnImage(context, job.key, {
      completionId: job.key.replaceAll("/", "-"),
      prompt: `${style}. ${job.visual}. ${TEXTLESS_PICTURE}`,
      aspectRatio: "16:9",
      width: SHOT_WIDTH,
      height: SHOT_HEIGHT,
    }))
      ? `${job.scene}:${job.shot}`
      : null,
  );
  const ready = new Set(drawn.filter((key): key is string => key !== null));

  if (ready.size === 0) {
    return;
  }

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

async function renderEpisodeChapter(
  context: ServiceContext,
  episodeId: string,
  chapterIndex: number,
  steps: TaskSteps,
): Promise<void> {
  const step = `chapter-${chapterIndex}`;

  try {
    const scripted = await steps.value(`${step}-script`, z.boolean(), () =>
      scriptEpisodeChapter(context, episodeId, chapterIndex),
    );

    if (!scripted) {
      return;
    }

    await steps.run(`${step}-narrate`, () =>
      narrateEpisodeChapter(context, episodeId, chapterIndex),
    );

    const { content } = await requireDiscoverEpisode(context, episodeId);
    const style = VIDEO_STYLE_PROMPTS[content.style];
    const jobs = chapterShotJobs(episodeId, content, chapterIndex);

    for (let start = 0; start < jobs.length; start += SHOT_BATCH) {
      await steps.run(`${step}-shots-${start / SHOT_BATCH}`, () =>
        drawChapterShots(
          context,
          episodeId,
          chapterIndex,
          style,
          jobs.slice(start, start + SHOT_BATCH),
        ),
      );
    }
  } catch (error) {
    logger.error("Episode chapter failed", {
      episodeId,
      chapterIndex,
      error_message: getErrorMessage(error),
    });
    await steps.run(`${step}-failed`, () =>
      saveChapter(context, episodeId, chapterIndex, (current) =>
        current.status === "ready" ? current : { ...current, status: "failed" },
      ),
    );
  }
}

export async function renderDiscoverEpisode(
  context: ServiceContext,
  episodeId: string,
  steps: TaskSteps,
  fromChapter = 0,
): Promise<void> {
  const { content } = await requireDiscoverEpisode(context, episodeId);

  for (let index = fromChapter; index < content.chapters.length; index += 1) {
    await renderEpisodeChapter(context, episodeId, index, steps);
  }

  await steps.run("extras", async () => {
    const { content: latest } = await requireDiscoverEpisode(context, episodeId);

    if (latest.chapters.every((chapter) => chapter.status === "ready")) {
      await makeEpisodeStudySet(context, episodeId);
    }
  });
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

export async function readEpisodeChapterAudio(
  context: ServiceContext,
  episodeId: string,
  chapterIndex: number,
  rangeHeader?: string | null,
) {
  await requireDiscoverEpisode(context, episodeId);

  return getPrivateObjectResponse(
    context,
    chapterAudioKey(episodeId, chapterIndex),
    { filename: `chapter-${chapterIndex + 1}.mp3`, mimeType: "audio/mpeg" },
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

  return getPrivateObjectResponse(
    context,
    shotImageKey(episodeId, content.seasonId, { ...location, plate: shot.plate }),
    { filename: "shot", mimeType: "image/png", cacheControl: IMMUTABLE_PRIVATE_CACHE_CONTROL },
  );
}

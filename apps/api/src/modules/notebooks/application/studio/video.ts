import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type {
  VideoOverviewOutputContent,
  VideoOverviewScene,
  VideoOverviewTiming,
} from "@ngriffin_uk/polychat-schemas";
import { mapWithConcurrency } from "@ngriffin_uk/polychat-utility-server/async";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { StorageService } from "~/infrastructure/storage";
import { synthesiseSpeech } from "~/modules/audio/application/speech";
import { resolveSpeechVoice } from "~/modules/audio/application/speech-voice";
import { renderWithSpeechVoices } from "~/modules/audio/application/speech-voices";
import { VIDEO_STYLE_PROMPTS } from "~/modules/notebooks/domain/studio-guidance";
import { OutputRepository } from "~/modules/outputs/infrastructure/OutputRepository";
import {
  estimateSpokenSeconds,
  joinAudioSegments,
  splitForSpeech,
} from "~/modules/sources/application/podcasts/audio";
import { UserSettingsRepository } from "~/modules/user/infrastructure/UserSettingsRepository";

import { generateStudioImage } from "./images";

const logger = getLogger({ prefix: "notebooks/video" });
const SCENE_IMAGE_CONCURRENCY = 3;
const SCENE_ASPECT_RATIO = "16:9";
const SCENE_WIDTH = 1280;
const SCENE_HEIGHT = 720;

export function videoSceneImageKey(outputId: string, index: number): string {
  return `outputs/${outputId}/scenes/${index}`;
}

export function timeScenes(
  segmentBytes: readonly number[],
  totalSeconds: number,
): VideoOverviewTiming[] {
  const totalBytes = segmentBytes.reduce((total, bytes) => total + bytes, 0);
  let start = 0;

  return segmentBytes.map((bytes) => {
    const duration = totalBytes > 0 ? (bytes / totalBytes) * totalSeconds : 0;
    const timing = { start, end: start + duration };

    start = timing.end;

    return timing;
  });
}

async function illustrateScene(
  context: ServiceContext,
  outputId: string,
  content: VideoOverviewOutputContent,
  scene: VideoOverviewScene,
  index: number,
): Promise<VideoOverviewScene> {
  try {
    const image = await generateStudioImage(context, {
      completionId: `${outputId}-scene-${index}`,
      prompt: `${VIDEO_STYLE_PROMPTS[content.style]}. ${scene.visual}. No text, letters, numbers or logos anywhere in the picture.`,
      aspectRatio: SCENE_ASPECT_RATIO,
      width: SCENE_WIDTH,
      height: SCENE_HEIGHT,
    });

    if (!image) {
      return scene;
    }

    await StorageService.forPrivateAssets(context).uploadObject(
      videoSceneImageKey(outputId, index),
      await image.arrayBuffer(),
      { httpMetadata: { contentType: image.type || "image/png" } },
    );

    return { ...scene, image: true };
  } catch (error) {
    logger.warn("Video scene illustration failed", {
      outputId,
      index,
      error_message: getErrorMessage(error),
    });

    return scene;
  }
}

async function narrate(
  context: ServiceContext,
  outputId: string,
  scenes: readonly VideoOverviewScene[],
  language: string,
): Promise<VideoOverviewTiming[]> {
  const user = context.requireUser();
  const settings = await new UserSettingsRepository(context.env).getUserSettings(user.id);
  const segments = await renderWithSpeechVoices(
    async () => ({
      narrator: await resolveSpeechVoice(context.env, user, { role: "narrator", settings }),
    }),
    async ({ narrator }) => {
      const rendered: Uint8Array[] = [];

      for (const scene of scenes) {
        const pieces: Uint8Array[] = [];

        for (const text of splitForSpeech(scene.narration)) {
          pieces.push(await synthesiseSpeech(context, narrator, text, language));
        }

        rendered.push(joinAudioSegments(pieces));
      }

      return rendered;
    },
  );
  const audio = joinAudioSegments(segments);
  const key = `outputs/${outputId}/narration.mp3`;

  await StorageService.forPrivateAssets(context).uploadObject(key, audio, {
    httpMetadata: { contentType: "audio/mpeg" },
  });
  await context.repositories.get(OutputRepository).attachOutputFile(outputId, {
    storageKey: key,
    mimeType: "audio/mpeg",
    filename: "narration.mp3",
    byteSize: audio.byteLength,
  });

  return timeScenes(
    segments.map((segment) => segment.byteLength),
    estimateSpokenSeconds(scenes.map((scene) => ({ speaker: "host", text: scene.narration }))),
  );
}

export async function produceVideoOverview(
  context: ServiceContext,
  outputId: string,
  content: VideoOverviewOutputContent,
  language: string,
): Promise<VideoOverviewOutputContent> {
  const [scenes, timings] = await Promise.all([
    mapWithConcurrency(content.scenes, SCENE_IMAGE_CONCURRENCY, (scene, index) =>
      illustrateScene(context, outputId, content, scene, index),
    ),
    narrate(context, outputId, content.scenes, language),
  ]);

  return { ...content, scenes, timings };
}

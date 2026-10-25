import type {
  VideoOverviewOutputContent,
  VideoOverviewScene,
  VideoOverviewTiming,
} from "@ngriffin_uk/polychat-schemas";
import { mapWithConcurrency } from "@ngriffin_uk/polychat-utility-server/async";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { StorageService } from "~/infrastructure/storage";
import { narratePassages } from "~/modules/audio/application/narration";
import { storeDrawnImage, TEXTLESS_PICTURE } from "~/modules/generate/application/stored-image";
import { VIDEO_STYLE_PROMPTS } from "~/modules/notebooks/domain/studio-guidance";
import { OutputRepository } from "~/modules/outputs/infrastructure/OutputRepository";

const SCENE_IMAGE_CONCURRENCY = 3;
const SCENE_ASPECT_RATIO = "16:9";
const SCENE_WIDTH = 1280;
const SCENE_HEIGHT = 720;

export function videoSceneImageKey(outputId: string, index: number): string {
  return `outputs/${outputId}/scenes/${index}`;
}

async function illustrateScene(
  context: ServiceContext,
  outputId: string,
  content: VideoOverviewOutputContent,
  scene: VideoOverviewScene,
  index: number,
): Promise<VideoOverviewScene> {
  const drawn = await storeDrawnImage(context, videoSceneImageKey(outputId, index), {
    completionId: `${outputId}-scene-${index}`,
    prompt: `${VIDEO_STYLE_PROMPTS[content.style]}. ${scene.visual}. ${TEXTLESS_PICTURE}`,
    aspectRatio: SCENE_ASPECT_RATIO,
    width: SCENE_WIDTH,
    height: SCENE_HEIGHT,
  });

  return drawn ? { ...scene, image: true } : scene;
}

async function narrate(
  context: ServiceContext,
  outputId: string,
  scenes: readonly VideoOverviewScene[],
  language: string,
): Promise<VideoOverviewTiming[]> {
  const { audio, timings } = await narratePassages(
    context,
    scenes.map((scene) => scene.narration),
    { language },
  );
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

  return timings;
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

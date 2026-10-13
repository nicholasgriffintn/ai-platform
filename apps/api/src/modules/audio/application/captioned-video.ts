import { CAPTION_VIDEO_MAX_BYTES, type TranscriptionResult } from "@ngriffin_uk/polychat-schemas";
import {
  buildCaptionCues,
  formatSrt,
  generateId,
  splitSegmentsIntoCues,
  type TimedSegment,
} from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { StorageService } from "~/infrastructure/storage";
import type { IUser } from "~/types";

import { handleTranscribe, type TranscriptionProvider } from "./transcribe";
import { resolveAuthorisedTranscriptionSource } from "./transcription-input";

const CAPTION_VIDEO_ENDPOINT = "https://computer.internal/computer/caption-video";
const CAPTION_VIDEO_TIMEOUT_MS = 300_000;
const MISTRAL_MAX_BYTES = 20 * 1024 * 1024;

export interface CaptionedVideo {
  videoUrl: string;
  sourceId: string;
  cueCount: number;
}

function captionCues(transcription: TranscriptionResult): TimedSegment[] {
  const cues = transcription.words?.length
    ? buildCaptionCues(transcription.words)
    : splitSegmentsIntoCues(transcription.segments ?? []);

  return cues.map(({ start, end, text }) => ({ start, end, text }));
}

export async function burnCaptionsIntoVideo({
  context,
  user,
  url,
  projectId,
}: {
  context: ServiceContext;
  user: IUser;
  url: string;
  projectId?: string;
}): Promise<CaptionedVideo> {
  const source = await resolveAuthorisedTranscriptionSource({ context, url, userId: user.id });

  if (!source.file.type.startsWith("video/")) {
    throw new AssistantError("Burned-in captions need a video file", ErrorType.PARAMS_ERROR, 415);
  }

  if (source.file.size > CAPTION_VIDEO_MAX_BYTES) {
    throw new AssistantError("The video is too large to caption", ErrorType.PARAMS_ERROR, 413);
  }

  const provider: TranscriptionProvider =
    source.file.size <= MISTRAL_MAX_BYTES ? "mistral" : "replicate";
  const transcription = await handleTranscribe({
    env: context.env,
    user,
    audio: source,
    allowVideo: true,
    provider,
    timestamps: true,
  });
  const cues = captionCues(transcription);

  if (cues.length === 0) {
    throw new AssistantError(
      "The transcription came back without timings, so captions cannot be placed",
      ErrorType.EXTERNAL_API_ERROR,
      502,
    );
  }

  const form = new FormData();

  form.append("resourceId", `caption-video-${generateId()}`);
  form.append("video", source.file, "input.mp4");
  form.append("captions", formatSrt(cues));

  const response = await context.env.SANDBOX_WORKER.fetch(CAPTION_VIDEO_ENDPOINT, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(CAPTION_VIDEO_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new AssistantError(
      "The video could not be encoded with captions",
      ErrorType.EXTERNAL_API_ERROR,
      502,
    );
  }

  const data = await response.arrayBuffer();
  const stored = await StorageService.forPrivateAssets(context).storeSourceFile({
    key: `captioned-videos/${user.id}/${generateId()}.mp4`,
    data,
    createdByUserId: user.id,
    projectId,
    title: "Captioned video",
    mimeType: "video/mp4",
    filename: "captioned-video.mp4",
    byteSize: data.byteLength,
  });

  return { videoUrl: stored.url, sourceId: stored.sourceId, cueCount: cues.length };
}

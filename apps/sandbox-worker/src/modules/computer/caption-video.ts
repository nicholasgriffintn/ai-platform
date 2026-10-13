import { errorResponse } from "@ngriffin_uk/polychat-library-sandbox";
import { CAPTION_VIDEO_MAX_BYTES } from "@ngriffin_uk/polychat-schemas";

import type { Env } from "../../types";

const RESOURCE_ID_PATTERN = /^caption-video-[A-Za-z0-9_-]{6,64}$/;
const MAX_CAPTION_CHARS = 2 * 1024 * 1024;
const JOB_DIRECTORY = "/workspace/caption-video";
const INPUT_PATH = `${JOB_DIRECTORY}/input.mp4`;
const CAPTIONS_PATH = `${JOB_DIRECTORY}/captions.srt`;
const OUTPUT_PATH = `${JOB_DIRECTORY}/output.mp4`;
const ENCODE_TIMEOUT_MS = 240_000;

const SUBTITLE_STYLE = [
  "Fontname=Noto Sans",
  "Fontsize=20",
  "PrimaryColour=&H00FFFFFF",
  "OutlineColour=&H00000000",
  "BorderStyle=3",
  "Outline=2",
  "Shadow=0",
  "MarginV=25",
].join(",");

const ENCODE_COMMAND = [
  "ffmpeg -y -hide_banner -loglevel error",
  `-i ${INPUT_PATH}`,
  `-vf "scale=-2:'min(720,ih)',subtitles=${CAPTIONS_PATH}:force_style='${SUBTITLE_STYLE}'"`,
  "-c:v libx264 -preset ultrafast -crf 28 -pix_fmt yuv420p",
  "-c:a copy -movflags +faststart",
  OUTPUT_PATH,
].join(" ");

export async function handleCaptionVideo(request: Request, env: Env): Promise<Response> {
  const form = await request.formData().catch(() => null);
  const resourceId = form?.get("resourceId");
  const video = form?.get("video");
  const captions = form?.get("captions");

  if (
    typeof resourceId !== "string" ||
    !RESOURCE_ID_PATTERN.test(resourceId) ||
    !(video instanceof File) ||
    video.size === 0 ||
    video.size > CAPTION_VIDEO_MAX_BYTES ||
    typeof captions !== "string" ||
    !captions.trim() ||
    captions.length > MAX_CAPTION_CHARS
  ) {
    return errorResponse(400, "Invalid caption video request");
  }

  const sandbox = env.COMPUTER.get(env.COMPUTER.idFromName(resourceId));

  try {
    await sandbox.exec(`mkdir -p ${JOB_DIRECTORY}`);
    await sandbox.writeFile(INPUT_PATH, await video.arrayBuffer());
    await sandbox.writeFile(CAPTIONS_PATH, captions);

    const encoded = await sandbox.exec(ENCODE_COMMAND, { timeoutMs: ENCODE_TIMEOUT_MS });

    if (!encoded.success) {
      return errorResponse(422, "The video could not be encoded with captions");
    }

    return new Response(await sandbox.readFileBytes(OUTPUT_PATH), {
      headers: { "Content-Type": "video/mp4" },
    });
  } catch {
    return errorResponse(502, "Caption encoding is unavailable");
  } finally {
    await sandbox.destroy().catch(() => undefined);
  }
}

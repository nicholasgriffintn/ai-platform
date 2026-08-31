import type { ServiceContext } from "~/lib/context/serviceContext";
import { StorageService } from "~/lib/storage";
import { getPrivateFileResourceFromUrl } from "~/lib/storage/resource-urls";
import { AssistantError, ErrorType } from "~/utils/errors";

export const MAX_TRANSCRIPTION_BYTES = 25 * 1024 * 1024;

export type TranscriptionAudioSource = { kind: "file"; file: Blob };

type AudioContainer = "aac" | "flac" | "mp3" | "mp4" | "ogg" | "wav" | "webm";

const CONTAINERS_BY_MIME_TYPE: Readonly<Record<string, readonly AudioContainer[]>> = {
  "audio/aac": ["aac"],
  "audio/flac": ["flac"],
  "audio/mp3": ["mp3"],
  "audio/mp4": ["mp4"],
  "audio/m4a": ["mp4"],
  "audio/mpeg": ["mp3"],
  "audio/ogg": ["ogg"],
  "audio/wav": ["wav"],
  "audio/webm": ["webm"],
  "audio/x-flac": ["flac"],
  "audio/x-m4a": ["mp4"],
  "audio/x-wav": ["wav"],
  "video/mp4": ["mp4"],
  "video/quicktime": ["mp4"],
  "video/webm": ["webm"],
};

function startsWith(bytes: Uint8Array, expected: readonly number[], offset = 0): boolean {
  return expected.every((value, index) => bytes[offset + index] === value);
}

function detectAudioContainer(bytes: Uint8Array): AudioContainer | undefined {
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x41, 0x56, 0x45], 8)
  ) {
    return "wav";
  }

  if (startsWith(bytes, [0x66, 0x4c, 0x61, 0x43])) {
    return "flac";
  }

  if (startsWith(bytes, [0x4f, 0x67, 0x67, 0x53])) {
    return "ogg";
  }

  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) {
    return "webm";
  }

  if (startsWith(bytes, [0x49, 0x44, 0x33]) || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) {
    return "mp3";
  }

  if (bytes[0] === 0xff && (bytes[1] === 0xf1 || bytes[1] === 0xf9)) {
    return "aac";
  }

  if (startsWith(bytes, [0x66, 0x74, 0x79, 0x70], 4)) {
    return "mp4";
  }

  return undefined;
}

function normaliseMimeType(value: string): string {
  return value.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

export async function assertValidTranscriptionFile(
  file: Blob,
  options: { allowVideo?: boolean; maxBytes?: number } = {},
): Promise<void> {
  const maxBytes = options.maxBytes ?? MAX_TRANSCRIPTION_BYTES;

  if (file.size === 0) {
    throw new AssistantError("Audio file is empty", ErrorType.PARAMS_ERROR, 400);
  }

  if (file.size > maxBytes) {
    throw new AssistantError(
      `Audio file exceeds the ${Math.floor(maxBytes / 1024 / 1024)} MB limit`,
      ErrorType.PARAMS_ERROR,
      413,
    );
  }

  const mimeType = normaliseMimeType(file.type);
  const allowedContainers = CONTAINERS_BY_MIME_TYPE[mimeType];

  if (!allowedContainers || (!options.allowVideo && mimeType.startsWith("video/"))) {
    throw new AssistantError("Unsupported audio file type", ErrorType.PARAMS_ERROR, 415);
  }

  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const container = detectAudioContainer(header);

  if (!container || !allowedContainers.includes(container)) {
    throw new AssistantError(
      "Audio file contents do not match its declared type",
      ErrorType.PARAMS_ERROR,
      415,
    );
  }
}

export async function resolveAuthorisedTranscriptionSource({
  context,
  url,
  userId,
}: {
  context: ServiceContext;
  url: string;
  userId: number;
}): Promise<TranscriptionAudioSource> {
  if (!getPrivateFileResourceFromUrl(url, context.env.API_BASE_URL)) {
    throw new AssistantError(
      "Only authorised stored media can be transcribed by URL",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const privateAsset = await StorageService.forPrivateAssets(context).getPrivateAssetBlob(
    url,
    userId,
    context.env.API_BASE_URL,
    {
      allowedMimePrefixes: ["audio/", "video/"],
      maxBytes: MAX_TRANSCRIPTION_BYTES,
    },
  );

  if (privateAsset) {
    await assertValidTranscriptionFile(privateAsset, { allowVideo: true });

    return { kind: "file", file: privateAsset };
  }

  throw new AssistantError("Private media was not found", ErrorType.NOT_FOUND, 404);
}

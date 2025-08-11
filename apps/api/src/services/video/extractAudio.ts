import { AssistantError, ErrorType } from "~/utils/errors";
import type { IEnv } from "~/types";

export type SupportedVideoPlatform = "youtube" | "vimeo" | "direct" | "unknown";

export interface VideoMetadata {
  originalUrl: string;
  platform: SupportedVideoPlatform;
  videoTitle?: string;
  durationSeconds?: number;
  thumbnailUrl?: string;
}

export interface VideoAudioExtractorResult {
  audio: File | Blob | string;
  metadata: VideoMetadata;
}

export interface VideoAudioExtractor {
  extractAudio(env: IEnv, url: string): Promise<VideoAudioExtractorResult>;
}

function detectPlatform(url: string): SupportedVideoPlatform {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host.includes("youtube.com") || host.includes("youtu.be")) return "youtube";
    if (host.includes("vimeo.com")) return "vimeo";
    const pathname = u.pathname.toLowerCase();
    if (pathname.endsWith(".mp3") || pathname.endsWith(".wav") || pathname.endsWith(".m4a") || pathname.endsWith(".aac")) {
      return "direct";
    }
    if (pathname.endsWith(".mp4") || pathname.endsWith(".webm") || pathname.endsWith(".mov")) {
      return "direct";
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}

function validateUrl(url: string) {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) {
      throw new AssistantError("URL must be http or https", ErrorType.PARAMS_ERROR);
    }
  } catch {
    throw new AssistantError("Invalid URL provided", ErrorType.PARAMS_ERROR);
  }
}

class DefaultVideoAudioExtractor implements VideoAudioExtractor {
  async extractAudio(_env: IEnv, url: string): Promise<VideoAudioExtractorResult> {
    validateUrl(url);
    const platform = detectPlatform(url);

    // For initial implementation, return the URL as a string to downstream transcription
    // providers which accept remote URLs. External extraction can be swapped in later.
    const metadata: VideoMetadata = {
      originalUrl: url,
      platform,
    };

    return { audio: url, metadata };
  }
}

export const VideoAudioExtractorFactory = {
  getDefault(): VideoAudioExtractor {
    return new DefaultVideoAudioExtractor();
  },
};
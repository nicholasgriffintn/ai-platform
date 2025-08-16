import type { IEnv } from "~/types";

export type VideoMetadata = {
  duration?: number;
  width?: number;
  height?: number;
  thumbnailUrl?: string;
};

export async function extractVideoMetadata(
  _env: IEnv,
  _url: string,
): Promise<VideoMetadata> {
  // Placeholder for future implementation using Cloudflare media processing or external service
  return {};
}

export async function generateVideoThumbnail(
  _env: IEnv,
  _url: string,
): Promise<string | undefined> {
  // Placeholder for future implementation
  return undefined;
}

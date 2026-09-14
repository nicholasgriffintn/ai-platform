import type { StorageService } from "~/lib/storage";
import type { IEnv, IUser } from "~/types";

import { providerLibrary } from "../../library";
import type { ProviderFactoryContext } from "../../registry/types";
import type { AudioResponseFormat } from "./formats";

export interface AudioSynthesisRequest {
  input: string;
  env: IEnv;
  user: IUser;
  slug?: string;
  storage?: StorageService;
  store?: boolean;
  voice?: string;
  locale?: string;
  refAudio?: string;
  responseFormat?: AudioResponseFormat;
  metadata?: Record<string, unknown>;
}

export interface AudioSynthesisResult {
  key?: string;
  url?: string;
  audioBase64?: string;
  audioDataUrl?: string;
  audioMimeType?: string;
  response?: string;
  metadata?: Record<string, unknown>;
  raw?: unknown;
}

export interface AudioProvider {
  name: string;
  synthesize(request: AudioSynthesisRequest): Promise<AudioSynthesisResult>;
}

/**
 * Resolve an audio provider from the provider library.
 * @param providerName - Registered provider identifier
 * @param context - Optional provider factory context (env, user, config)
 */
export function getAudioProvider(
  providerName: string,
  context?: ProviderFactoryContext,
): AudioProvider {
  return providerLibrary.audio(providerName, context);
}

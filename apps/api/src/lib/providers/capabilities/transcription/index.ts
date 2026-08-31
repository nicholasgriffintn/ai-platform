import type { TranscriptionAudioSource } from "~/services/audio/transcription-input";
import type { IEnv, IUser } from "~/types";

import { providerLibrary } from "../../library";
import type { ProviderFactoryContext } from "../../registry/types";

export interface TranscriptionRequest {
  env: IEnv;
  audio: TranscriptionAudioSource;
  user: IUser;
  provider?: string;
  timestamps?: boolean;
}

export interface TranscriptionResult {
  text: string;
  data?: unknown;
  metadata?: Record<string, unknown>;
}

export interface TranscriptionProvider {
  name: string;
  transcribe(request: TranscriptionRequest): Promise<TranscriptionResult>;
}

export { BaseTranscriptionProvider } from "./base";

/**
 * Resolve a transcription provider instance from the provider library.
 * @param providerName - Registered provider identifier
 * @param context - Optional provider factory context (env, user, config)
 */
export function getTranscriptionProvider(
  providerName: string,
  context?: ProviderFactoryContext,
): TranscriptionProvider {
  return providerLibrary.transcription(providerName, context);
}

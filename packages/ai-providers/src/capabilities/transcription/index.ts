import type { ProviderEnv, ProviderUser } from "../../env.js";

export type TranscriptionAudioSource = { kind: "file"; file: Blob };

export interface TranscriptionRequest {
  env: ProviderEnv;
  audio: TranscriptionAudioSource;
  user: ProviderUser;
  provider?: string;
  model?: string;
  language?: string;
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

export { BaseTranscriptionProvider } from "./base.js";

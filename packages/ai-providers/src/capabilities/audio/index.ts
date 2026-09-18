import type { ProviderEnv, ProviderUser } from "../../env.js";
import type { ProviderStorage } from "../../host.js";
import type { AudioResponseFormat } from "./formats.js";

export interface AudioSynthesisRequest {
  input: string;
  env: ProviderEnv;
  user: ProviderUser;
  slug?: string;
  storage?: ProviderStorage;
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

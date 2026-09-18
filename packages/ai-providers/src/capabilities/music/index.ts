import type { ProviderEnv, ProviderUser } from "../../env.js";
import type { ProviderStorage } from "../../host.js";

export interface MusicGenerationRequest {
  prompt: string;
  env: ProviderEnv;
  user: ProviderUser;
  completion_id?: string;
  app_url?: string;
  slug?: string;
  storage?: ProviderStorage;
  inputAudio?: string;
  duration?: number;
  model?: string;
  metadata?: Record<string, unknown>;
}

export interface MusicGenerationResult {
  key?: string;
  url?: string;
  response?: string;
  metadata?: Record<string, unknown>;
  raw?: unknown;
}

export interface MusicProvider {
  name: string;
  models?: string[];
  generate(request: MusicGenerationRequest): Promise<MusicGenerationResult>;
}

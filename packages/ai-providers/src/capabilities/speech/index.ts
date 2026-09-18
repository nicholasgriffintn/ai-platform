import type { ProviderEnv, ProviderUser } from "../../env.js";
import type { ProviderStorage } from "../../host.js";

export interface SpeechGenerationRequest {
  prompt: string;
  env: ProviderEnv;
  user: ProviderUser;
  completion_id?: string;
  app_url?: string;
  slug?: string;
  storage?: ProviderStorage;
  voice?: string;
  locale?: string;
  model?: string;
  metadata?: Record<string, unknown>;
}

export interface SpeechGenerationResult {
  key?: string;
  url?: string;
  response?: string;
  metadata?: Record<string, unknown>;
  raw?: unknown;
}

export interface SpeechProvider {
  name: string;
  models?: string[];
  generate(request: SpeechGenerationRequest): Promise<SpeechGenerationResult>;
}

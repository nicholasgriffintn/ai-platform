import type { ProviderEnv, ProviderUser } from "../../env.js";
import type { ProviderStorage } from "../../host.js";

export interface VideoGenerationRequest {
  prompt: string;
  env: ProviderEnv;
  user: ProviderUser;
  completion_id?: string;
  app_url?: string;
  slug?: string;
  storage?: ProviderStorage;
  negativePrompt?: string;
  aspectRatio?: string;
  width?: number;
  height?: number;
  duration?: number;
  videoLength?: number;
  guidanceScale?: number;
  model?: string;
  metadata?: Record<string, unknown>;
}

export interface VideoGenerationResult {
  key?: string;
  url?: string;
  status?: string;
  response?: string;
  metadata?: Record<string, unknown>;
  raw?: unknown;
}

export interface VideoProvider {
  name: string;
  models?: string[];
  generate(request: VideoGenerationRequest): Promise<VideoGenerationResult>;
}

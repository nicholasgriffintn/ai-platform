import type { ProviderEnv, ProviderUser } from "../../env.js";
import type { ProviderStorage } from "../../host.js";

export interface ImageGenerationRequest {
  prompt: string;
  env: ProviderEnv;
  user: ProviderUser;
  completion_id?: string;
  app_url?: string;
  slug?: string;
  storage?: ProviderStorage;
  style?: string;
  aspectRatio?: string;
  width?: number;
  height?: number;
  steps?: number;
  model?: string;
  metadata?: Record<string, unknown>;
}

export interface ImageGenerationResult {
  key?: string;
  url?: string;
  response?: string;
  metadata?: Record<string, unknown>;
  raw?: unknown;
}

export interface ImageProvider {
  name: string;
  models?: string[];
  generate(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
}

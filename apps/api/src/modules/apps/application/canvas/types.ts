import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import type { CanvasGenerateRequest } from "@ngriffin_uk/polychat-schemas/experiences";

export type CanvasMode = "image" | "video";
export type CanvasGenerationStatus = "queued" | "processing" | "completed" | "succeeded" | "failed";

export interface CanvasGenerationInput {
  mode: CanvasMode;
  prompt: string;
  negativePrompt?: string;
  referenceImages?: string[];
  aspectRatio?: string;
  resolution?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  generateAudio?: boolean;
  modelOptions?: Record<string, string | number | boolean | string[]>;
}

export type CanvasGenerateParams = CanvasGenerateRequest;

export interface CanvasGenerationListItem {
  id: string;
  itemId?: string;
  modelId: string;
  modelName?: string;
  provider?: string;
  mode?: CanvasMode;
  status: CanvasGenerationStatus;
  createdAt?: string;
  updatedAt?: string;
  input?: Record<string, unknown>;
  output?: unknown;
  error?: string;
  predictionData?: unknown;
}

export interface CanvasModelListItem {
  id: string;
  name: string;
  description?: string;
  provider: string;
  costPerRun?: number;
  modalities: ModelConfigItem["modalities"];
  strengths?: string[];
  isFeatured?: boolean;
  requiresReferenceImage?: boolean;
  inputSchema?: ModelConfigItem["inputSchema"];
}

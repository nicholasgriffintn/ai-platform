import type { availableCapabilities, availableModelTypes } from "~/lib/models";

export type ModelRanking = 1 | 2 | 3 | 4 | 5;

export interface ModelConfigInfo {
  model: string;
  provider: string;
  displayName: string;
}

export type ModelConfigItem = {
  matchingModel: string;
  name?: string;
  description?: string;
  provider: string;
  type: Array<(typeof availableModelTypes)[number]>;
  isBeta?: boolean;
  supportsFunctions?: boolean;
  isFree?: boolean;
  card?: string;
  contextWindow?: number;
  maxTokens?: number;
  costPer1kInputTokens?: number;
  costPer1kOutputTokens?: number;
  costPer1kReasoningTokens?: number;
  costPer1kSearches?: number;
  strengths?: Array<(typeof availableCapabilities)[number]>;
  contextComplexity?: ModelRanking;
  reliability?: ModelRanking;
  speed?: ModelRanking;
  multimodal?: boolean;
  hasThinking?: boolean;
  requiresThinkingPrompt?: boolean;
  includedInRouter?: boolean;
  isFeatured?: boolean;
  supportsResponseFormat?: boolean;
  supportsArtifacts?: boolean;
  supportsStreaming?: boolean;
  supportsDocuments?: boolean;
  beta?: boolean;
  supportsSearchGrounding?: boolean;
  supportsCodeExecution?: boolean;
  timeout?: number;
  supportsAudio?: boolean;
};

export type ModelConfig = {
  [key: string]: ModelConfigItem;
};

export interface PromptRequirements {
  expectedComplexity: ModelRanking;
  requiredCapabilities: Array<(typeof availableCapabilities)[number]>;
  criticalCapabilities?: Array<(typeof availableCapabilities)[number]>;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  hasImages: boolean;
  hasDocuments?: boolean;
  needsFunctions: boolean;
  budget_constraint?: number;
  benefitsFromMultipleModels?: boolean;
  modelComparisonReason?: string;
}

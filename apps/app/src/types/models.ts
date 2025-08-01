export type ModelRanking = 1 | 2 | 3 | 4 | 5;

export interface ModelConfigItem {
  id: string;
  matchingModel: string;
  name?: string;
  description?: string;
  avatarUrl?: string;
  provider: string;
  type: string[];
  isBeta?: boolean;
  supportsFunctions?: boolean;
  isFree?: boolean;
  card?: string;
  contextWindow?: number;
  maxTokens?: number;
  costPer1kInputTokens?: number;
  costPer1kOutputTokens?: number;
  strengths?: string[];
  contextComplexity?: ModelRanking;
  reliability?: ModelRanking;
  speed?: ModelRanking;
  multimodal?: boolean;
  includedInRouter?: boolean;
  isFeatured?: boolean;
  hasThinking?: boolean;
  supportsDocuments?: boolean;
  supportsSearchGrounding?: boolean;
  supportsCodeExecution?: boolean;
  supportsAudio?: boolean;
  supportsImageEdits?: boolean;
}

export interface ModelConfig {
  [key: string]: ModelConfigItem;
}

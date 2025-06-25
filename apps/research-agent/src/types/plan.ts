import type { RetryPolicy, SourceType, StageType } from "./core";

export interface PlanTemplate {
  name: string;
  description: string;
  stageTemplates: StageTemplate[];
}

export interface StageTemplate {
  type: StageType;
  name: string;
  pluginHints?: string[];
  dependsOn?: StageType[];
  timeout?: number;
  retryPolicy?: RetryPolicy;
  conditions?: StageConditions;
  defaultConfig: Record<string, any>;
}

export interface StageConditions {
  requiresSentiment?: boolean;
  requiresEntities?: boolean;
  requiresFactCheck?: boolean;
  requiresTrends?: boolean;
  minSources?: number;
  requiredSourceTypes?: SourceType[];
}

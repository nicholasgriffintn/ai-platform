import type { AssistantModelMetadata } from "@ngriffin_uk/polychat-ai-prompts";
import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";

export interface PromptModelMetadata {
  modelId?: string;
  modelConfig?: ModelConfigItem;
}

export interface PromptModelRequest {
  model?: string;
}

export function toAssistantModelMetadata({
  modelId,
  modelConfig,
  request,
  fallbackModelId,
}: {
  modelId?: string;
  modelConfig?: ModelConfigItem;
  request?: PromptModelRequest;
  fallbackModelId?: string;
}): AssistantModelMetadata {
  const activeModelId =
    modelId || request?.model || modelConfig?.matchingModel || fallbackModelId || "unknown";

  return {
    modelId: activeModelId,
    provider: modelConfig?.provider,
    displayName: modelConfig?.name ?? modelConfig?.matchingModel ?? activeModelId,
    inputModalities: modelConfig?.modalities?.input,
    outputModalities: modelConfig?.modalities?.output,
    knowledgeCutoff: modelConfig?.knowledgeCutoffDate,
    supportsToolCalls: modelConfig?.supportsToolCalls,
  };
}

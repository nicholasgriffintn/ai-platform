import { hasProviderReasoningOptions } from "@ngriffin_uk/polychat-ai-models";
import type { AssistantModelMetadata } from "@ngriffin_uk/polychat-ai-prompts";
import { resolveEffectiveMaxTokens } from "@ngriffin_uk/polychat-ai-providers";
import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";

export interface PromptModelMetadata {
  modelId?: string;
  modelConfig?: ModelConfigItem;
}

export interface PromptTokenLimits {
  model?: string;
  max_tokens?: number;
  max_completion_tokens?: number;
  max_output_tokens?: number;
}

export function toAssistantModelMetadata({
  modelId,
  modelConfig,
  request,
  fallbackModelId,
}: {
  modelId?: string;
  modelConfig?: ModelConfigItem;
  request?: PromptTokenLimits;
  fallbackModelId?: string;
}): AssistantModelMetadata {
  const activeModelId =
    modelId || request?.model || modelConfig?.matchingModel || fallbackModelId || "unknown";
  const supportedCapabilities = [
    modelConfig?.supportsToolCalls ? "tool_calls" : null,
    hasProviderReasoningOptions(modelConfig) ? "reasoning" : null,
    modelConfig?.supportsDocuments ? "documents" : null,
    modelConfig?.supportsSearchGrounding ? "search_grounding" : null,
    modelConfig?.supportsCodeExecution ? "code_execution" : null,
    modelConfig?.supportsAttachments ? "attachments" : null,
    modelConfig?.supportsResponseFormat ? "response_format" : null,
  ].filter((capability): capability is string => Boolean(capability));

  return {
    modelId: activeModelId,
    provider: modelConfig?.provider,
    displayName: modelConfig?.name ?? modelConfig?.matchingModel ?? activeModelId,
    inputModalities: modelConfig?.modalities?.input,
    outputModalities: modelConfig?.modalities?.output,
    contextWindow: modelConfig?.contextWindow,
    effectiveMaxOutputTokens: resolveEffectiveMaxTokens(
      {
        ...request,
        max_tokens:
          request?.max_tokens ?? request?.max_completion_tokens ?? request?.max_output_tokens,
      },
      modelConfig,
    ),
    knowledgeCutoff: modelConfig?.knowledgeCutoffDate,
    releaseDate: modelConfig?.releaseDate,
    lastUpdated: modelConfig?.lastUpdated,
    supportedCapabilities,
    supportsToolCalls: modelConfig?.supportsToolCalls,
  };
}

import type { ModelModalities, ModelModality } from "@ngriffin_uk/polychat-schemas";

export const availableModalities = [
  "text",
  "image",
  "audio",
  "video",
  "pdf",
  "document",
  "embedding",
  "moderation",
  "speech",
  "voice-activity-detection",
  "guardrails",
  "reranking",
  "search",
  "creative",
  "instruction",
  "summarization",
  "multilingual",
  "general_knowledge",
  "coding",
  "reasoning",
  "vision",
  "chat",
  "math",
  "analysis",
  "tool_use",
  "academic",
  "research",
  "agents",
  "ocr",
  "transcription",
  "decision",
] as const;

const DEFAULT_MODALITIES: ModelModalities = {
  input: ["text"],
  output: ["text"],
};

type ModelConfigWithModalities = {
  modalities?: ModelModalities;
};

export function getModelInputModalities(
  modelConfig: ModelConfigWithModalities,
): ModelModalities["input"] {
  return modelConfig.modalities?.input ?? DEFAULT_MODALITIES.input;
}

export function getModelOutputModalities(
  modelConfig: ModelConfigWithModalities,
): ModelModalities["input"] {
  return modelConfig.modalities?.output ?? getModelInputModalities(modelConfig);
}

export function hasModelTextOutput(modelConfig: ModelConfigWithModalities): boolean {
  const inputs = getModelInputModalities(modelConfig);
  const outputs = getModelOutputModalities(modelConfig);

  return outputs.includes("text") || (!outputs.length && inputs.includes("text"));
}

export function producesNonTextPrimaryOutput(modelConfig: ModelConfigWithModalities): boolean {
  const outputs = getModelOutputModalities(modelConfig);

  return outputs.includes("audio") || (outputs.includes("image") && !outputs.includes("text"));
}

export function getModelModalities(modelConfig: ModelConfigWithModalities): ModelModalities {
  return modelConfig.modalities ?? DEFAULT_MODALITIES;
}

export function modelSupportsModality(
  modelConfig: ModelConfigWithModalities,
  modality: ModelModality,
): boolean {
  const modalities = getModelModalities(modelConfig);

  return modalities.input.includes(modality) || Boolean(modalities.output?.includes(modality));
}

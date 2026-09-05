import type { ModelConfigItem, ModelModality } from "@ngriffin_uk/polychat-schemas";

const CHAT_RENDERABLE_OUTPUTS: ReadonlySet<ModelModality> = new Set<ModelModality>([
  "text",
  "image",
  "audio",
  "video",
]);

const NON_CHAT_MODEL_PATTERN =
  /(^|[-_/.:])(embed|embedding|embeddings|rerank|reranker|reranking|moderation|guardrail|guardrails|vad|whisper|transcribe|transcription|tts|text-to-speech)([-_/.:]|$)/i;

export function isChatSurfaceModel(model: ModelConfigItem): boolean {
  const modalities = model.modalities;
  const inputs = modalities?.input ?? ["text"];
  const outputs = modalities?.output ?? ["text"];

  if (!inputs.includes("text")) {
    return false;
  }

  if (!outputs.some((output) => CHAT_RENDERABLE_OUTPUTS.has(output))) {
    return false;
  }

  const identifiers = [model.id, model.matchingModel, model.name].filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );

  return !identifiers.some((identifier) => NON_CHAT_MODEL_PATTERN.test(identifier));
}

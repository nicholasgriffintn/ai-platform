export const availableCapabilities = [
  "research",
  "coding",
  "math",
  "creative",
  "analysis",
  "chat",
  "search",
  "multilingual",
  "reasoning",
  "vision",
  "summarization",
  "audio",
  "academic",
  "instruction",
  "general_knowledge",
  "image_generation",
  "agents",
] as const;

export const availableModelTypes = [
  "text",
  "coding",
  "speech",
  "text-to-speech",
  "image-to-text",
  "image-to-image",
  "text-to-image",
  "embedding",
  "reranking",
  "instruct",
  "text-to-video",
  "image-to-video",
  "guardrails",
] as const;

export const defaultModel = "mistral-medium";
export const defaultProvider = "mistral";

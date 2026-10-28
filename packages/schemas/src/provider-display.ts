import { capitaliseFirst, titleCaseSlug } from "@ngriffin_uk/polychat-utility-core";

const UPPERCASE_MODEL_SEGMENTS = new Set(["gpt", "glm", "oss", "tts", "ai", "o", "qvq", "mai"]);

const PROVIDER_LABELS: Readonly<Record<string, string>> = {
  deepseek: "DeepSeek",
  deepinfra: "DeepInfra",
  elevenlabs: "ElevenLabs",
  "google-ai-studio": "Google AI Studio",
  greenpt: "GreenPT",
  lmstudio: "LM Studio",
  minimax: "MiniMax",
  openai: "OpenAI",
  openrouter: "OpenRouter",
  typesafe: "TypeSafe",
  "web-llm": "WebLLM",
  "workers-ai": "Workers AI",
  xai: "xAI",
  zai: "Z.ai",
};

export function formatProviderLabel(provider: string) {
  return PROVIDER_LABELS[provider] ?? titleCaseSlug(provider);
}

export function formatModelFamilyLabel(family: string) {
  return family
    .split(/[-_]/g)
    .filter(Boolean)
    .map((segment) =>
      UPPERCASE_MODEL_SEGMENTS.has(segment.toLowerCase())
        ? segment.toUpperCase()
        : capitaliseFirst(segment),
    )
    .join(" ");
}

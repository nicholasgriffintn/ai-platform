import { capitaliseFirst, titleCaseSlug } from "@ngriffin_uk/polychat-utility-core";

const UPPERCASE_MODEL_SEGMENTS = new Set(["gpt", "glm", "oss", "tts", "ai", "o", "qvq", "mai"]);

export function formatProviderLabel(provider: string) {
  return titleCaseSlug(provider);
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

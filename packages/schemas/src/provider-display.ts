const UPPERCASE_MODEL_SEGMENTS = new Set(["gpt", "glm", "oss", "tts", "ai", "o", "qvq", "mai"]);

export function formatProviderLabel(provider: string) {
  return provider
    .split(/[-_]/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function formatModelFamilyLabel(family: string) {
  return family
    .split(/[-_]/g)
    .filter(Boolean)
    .map((segment) =>
      UPPERCASE_MODEL_SEGMENTS.has(segment.toLowerCase())
        ? segment.toUpperCase()
        : segment.charAt(0).toUpperCase() + segment.slice(1),
    )
    .join(" ");
}

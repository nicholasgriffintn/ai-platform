export const MODEL_SOURCES_ONBOARDING_KEYS = {
  web: "model-sources:web",
  desktop: "model-sources:desktop",
} as const;

export type ModelSourceSurface = keyof typeof MODEL_SOURCES_ONBOARDING_KEYS;

export function appendOnboardingSeen(seen: readonly string[] | undefined, key: string): string[] {
  return seen?.includes(key) ? [...seen] : [...(seen ?? []), key];
}

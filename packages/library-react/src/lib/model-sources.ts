export const MODEL_SOURCES_ONBOARDING_KEYS = {
  web: "model-sources:web",
  desktop: "model-sources:desktop",
} as const;

export type ModelSourceSurface = keyof typeof MODEL_SOURCES_ONBOARDING_KEYS;

export const LEGACY_PROVIDER_SETUP_DISMISSAL_KEY =
  "polychat:composer-banner:provider-setup:dismissed";

export function hasLegacyProviderSetupDismissal(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return Boolean(window.localStorage.getItem(LEGACY_PROVIDER_SETUP_DISMISSAL_KEY));
  } catch {
    return false;
  }
}

export function appendOnboardingSeen(seen: readonly string[] | undefined, key: string): string[] {
  return seen?.includes(key) ? [...seen] : [...(seen ?? []), key];
}

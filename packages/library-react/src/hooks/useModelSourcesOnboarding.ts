import { useCallback, useEffect, useRef } from "react";

import {
  appendOnboardingSeen,
  MODEL_SOURCES_ONBOARDING_KEYS,
  type ModelSourceSurface,
} from "../lib/model-sources.js";
import { useUIStore } from "../state/stores/uiStore.js";
import { useAuthStatus } from "./useAuth.js";

export function useModelSourcesOnboarding(surface?: ModelSourceSurface) {
  const isOpen = useUIStore((state) => state.showModelSources);
  const setShowModelSources = useUIStore((state) => state.setShowModelSources);
  const { isAuthenticated, isLoading, user, userSettings, updateUserSettings } = useAuthStatus();
  const onboardingHandledFor = useRef<string | null>(null);
  const onboardingKey = surface ? MODEL_SOURCES_ONBOARDING_KEYS[surface] : null;

  useEffect(() => {
    if (!onboardingKey) {
      return;
    }

    if (!isAuthenticated) {
      onboardingHandledFor.current = null;

      return;
    }

    if (isLoading || !user || !userSettings) {
      return;
    }

    const accountKey = `${user.id}:${onboardingKey}`;

    if (onboardingHandledFor.current === accountKey) {
      return;
    }

    if (userSettings.onboarding_seen?.includes(onboardingKey)) {
      onboardingHandledFor.current = accountKey;

      return;
    }

    onboardingHandledFor.current = accountKey;
    const nextOnboardingSeen = appendOnboardingSeen(userSettings.onboarding_seen, onboardingKey);

    setShowModelSources(true);

    void updateUserSettings({ onboarding_seen: nextOnboardingSeen }).catch(() => undefined);
  }, [
    isAuthenticated,
    isLoading,
    onboardingKey,
    setShowModelSources,
    updateUserSettings,
    user,
    userSettings,
  ]);

  const open = useCallback(() => setShowModelSources(true), [setShowModelSources]);

  return {
    isOpen,
    open,
    onOpenChange: setShowModelSources,
  };
}

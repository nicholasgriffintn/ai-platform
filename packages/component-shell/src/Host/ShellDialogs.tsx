import type { ModelSource } from "@ngriffin_uk/polychat-component-models";
import {
  useUIStore,
  appendOnboardingSeen,
  hasLegacyProviderSetupDismissal,
  MODEL_SOURCES_ONBOARDING_KEYS,
  useAuthStatus,
  useUser,
} from "@ngriffin_uk/polychat-library-react";
import { lazy, Suspense, useEffect, useMemo, useRef } from "react";

import { useShellHost } from "./ShellHostContext.js";

const MetaAssistantOverlay = lazy(() =>
  import("../MetaAssistant/MetaAssistantOverlay.js").then((module) => ({
    default: module.MetaAssistantOverlay,
  })),
);

const NewProjectConversationDialog = lazy(() =>
  import("../Work/NewProjectConversationDialog.js").then((module) => ({
    default: module.NewProjectConversationDialog,
  })),
);

const ModelSourcesDialog = lazy(() =>
  import("@ngriffin_uk/polychat-component-models").then((module) => ({
    default: module.ModelSourcesDialog,
  })),
);

export function ShellDialogs() {
  const host = useShellHost();
  const {
    showMetaAssistant,
    setShowMetaAssistant,
    showProjectPicker,
    setShowProjectPicker,
    showModelSources,
    setShowModelSources,
  } = useUIStore();
  const { isAuthenticated, isLoading, user, userSettings, updateUserSettings } = useAuthStatus();
  const { providerSettings, isLoadingProviderSettings } = useUser({ enabled: isAuthenticated });
  const surface = host.modelSourceSurface ?? "web";
  const onboardingKey = MODEL_SOURCES_ONBOARDING_KEYS[surface];
  const onboardingHandledFor = useRef<string | null>(null);

  useEffect(() => {
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

    if (!(surface === "web" && hasLegacyProviderSetupDismissal())) {
      setShowModelSources(true);
    }

    void updateUserSettings({ onboarding_seen: nextOnboardingSeen }).catch(() => undefined);
  }, [
    isAuthenticated,
    isLoading,
    onboardingKey,
    setShowModelSources,
    surface,
    updateUserSettings,
    user,
    userSettings,
  ]);

  const modelSources = useMemo<readonly ModelSource[]>(() => {
    const hasProviderKeys = providerSettings.some((provider) => provider.hasApiKey);

    return [
      {
        id: "polychat",
        name: "Polychat",
        detail: surface === "desktop" ? "Ready. Included in your plan." : "Ready",
        readiness: "ready",
      },
      {
        id: "provider-keys",
        name: "Your provider keys",
        detail: isLoadingProviderSettings
          ? "Checking…"
          : hasProviderKeys
            ? "Configured"
            : "None configured",
        readiness: hasProviderKeys ? "ready" : "not-configured",
        action: {
          label: "Add keys",
          onSelect: host.openProviderSettings ?? host.openSignIn,
        },
      },
      ...(host.modelSourceRows ?? []),
    ];
  }, [
    host.modelSourceRows,
    host.openProviderSettings,
    host.openSignIn,
    isLoadingProviderSettings,
    providerSettings,
    surface,
  ]);

  return (
    <>
      {showMetaAssistant && (
        <Suspense fallback={null}>
          <MetaAssistantOverlay open onClose={() => setShowMetaAssistant(false)} />
        </Suspense>
      )}
      {showProjectPicker && (
        <Suspense fallback={null}>
          <NewProjectConversationDialog open onOpenChange={setShowProjectPicker} />
        </Suspense>
      )}
      {showModelSources && (
        <Suspense fallback={null}>
          <ModelSourcesDialog
            open={showModelSources}
            sources={modelSources}
            onOpenChange={setShowModelSources}
          />
        </Suspense>
      )}
    </>
  );
}

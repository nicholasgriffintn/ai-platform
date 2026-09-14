import type {
  BrowserModelDownloadProgress,
  ModelSource,
} from "@ngriffin_uk/polychat-component-models";
import {
  useUIStore,
  getCachedWebLLMModels,
  pruneStaleWebLLMModels,
  useAuthStatus,
  useBrowserModelConsent,
  useModelSourcesOnboarding,
  useUser,
  WebLLMService,
} from "@ngriffin_uk/polychat-library-react";
import { lazy, Suspense, useCallback, useMemo } from "react";

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

const BrowserModelConsentDialog = lazy(() =>
  import("@ngriffin_uk/polychat-component-models").then((module) => ({
    default: module.BrowserModelConsentDialog,
  })),
);

export function ShellDialogs() {
  const host = useShellHost();
  const { showMetaAssistant, setShowMetaAssistant, showProjectPicker, setShowProjectPicker } =
    useUIStore();
  const { isAuthenticated } = useAuthStatus();
  const { providerSettings, isLoadingProviderSettings } = useUser({ enabled: isAuthenticated });
  const {
    pendingModelId,
    pendingModelName,
    confirmPendingBrowserModel,
    cancelPendingBrowserModel,
  } = useBrowserModelConsent();
  const surface = host.modelSourceSurface ?? "web";
  const { isOpen: showModelSources, onOpenChange: setShowModelSources } =
    useModelSourcesOnboarding(surface);

  const handleDownloadBrowserModel = useCallback(
    async (
      modelId: string,
      onProgress: (progress: BrowserModelDownloadProgress) => void,
    ): Promise<void> => {
      await WebLLMService.getInstance().init(modelId, onProgress);
      await pruneStaleWebLLMModels(modelId, Object.keys(getCachedWebLLMModels()));
    },
    [],
  );

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
      {pendingModelId && (
        <Suspense fallback={null}>
          <BrowserModelConsentDialog
            key={pendingModelId}
            open
            modelId={pendingModelId}
            modelName={pendingModelName ?? pendingModelId}
            onDownload={handleDownloadBrowserModel}
            onConfirm={confirmPendingBrowserModel}
            onCancel={cancelPendingBrowserModel}
          />
        </Suspense>
      )}
    </>
  );
}

import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import type { ModelConfig } from "@ngriffin_uk/polychat-schemas";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useLoadingActions } from "../state/LoadingContext.js";
import { useWebLLMConsentStore } from "../state/stores/webLLMConsentStore.js";
import { useWebLLMModels } from "./useWebLLMModels.js";
import { getCachedWebLLMModels } from "./web-llm-models.js";
import { pruneStaleWebLLMModels, WebLLMService } from "./web-llm.js";

export function useWebLLMInitialization(apiModels: ModelConfig = {}) {
  const { startLoading, updateLoading, stopLoading } = useLoadingActions();
  const { computeSite, model, setModel } = useChatStore();
  const webLLMModels = useWebLLMModels({ enabled: computeSite === "browser" });
  const isConsented = useWebLLMConsentStore((state) =>
    model ? (state.consentedModelIds[model] ?? false) : false,
  );
  const pendingModelId = useWebLLMConsentStore((state) => state.pendingModelId);
  const requestConsent = useWebLLMConsentStore((state) => state.requestConsent);

  const [webLLMService] = useState(() => WebLLMService.getInstance());
  const [isInitializing, setIsInitializing] = useState(false);

  const matchingModel =
    model === null ? undefined : computeSite === "browser" ? webLLMModels[model] : apiModels[model];
  const shouldLoadBrowserModel = Boolean(
    model && computeSite === "browser" && matchingModel?.provider === "web-llm",
  );
  const isAwaitingConsent = shouldLoadBrowserModel && !isConsented;

  useEffect(() => {
    const loadingId = "model-init";
    let mounted = true;

    if (!shouldLoadBrowserModel) {
      stopLoading(loadingId);
      // eslint-disable-next-line react/set-state-in-effect - Idempotent reset for a download superseded mid-flight; React bails out when unchanged.
      setIsInitializing(false);

      return () => {
        mounted = false;
      };
    }

    if (!isConsented) {
      if (model && pendingModelId !== model) {
        requestConsent(model);
      }

      stopLoading(loadingId);
      setIsInitializing(false);

      return () => {
        mounted = false;
      };
    }

    const initializeLocalModel = async () => {
      if (!mounted) {
        return;
      }

      if (model && computeSite === "browser" && matchingModel?.provider === "web-llm") {
        try {
          setIsInitializing(true);

          startLoading(loadingId, `Initializing ${matchingModel.name || model}...`);

          updateLoading(loadingId, 0, `Preparing to load ${matchingModel.name || model}...`);

          await webLLMService.init(model, (progress) => {
            if (!mounted) {
              return;
            }

            const progressPercent = Math.round(progress.progress * 100);

            updateLoading(
              loadingId,
              Math.max(1, progressPercent),
              progress.text || `Loading ${matchingModel.name || model}...`,
            );
          });

          if (mounted) {
            void pruneStaleWebLLMModels(model, Object.keys(getCachedWebLLMModels()));
          }
        } catch (error) {
          console.error("[useWebLLMInitialization] Failed to initialize WebLLM:", error);
          if (mounted) {
            toast.error("Failed to initialize local model. Please try again.");
            setModel(null);
          }
        } finally {
          if (mounted) {
            stopLoading(loadingId);
            setIsInitializing(false);
          }
        }
      } else {
        stopLoading(loadingId);
        setIsInitializing(false);
      }
    };

    const timer = setTimeout(() => {
      void initializeLocalModel();
    }, 100);

    return () => {
      mounted = false;
      clearTimeout(timer);
      stopLoading(loadingId);
    };
  }, [
    computeSite,
    model,
    matchingModel,
    shouldLoadBrowserModel,
    isConsented,
    pendingModelId,
    requestConsent,
    startLoading,
    updateLoading,
    stopLoading,
    setModel,
    webLLMService,
  ]);

  return {
    webLLMService: webLLMService,
    isInitializing,
    isAwaitingConsent,
  };
}

import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import type { ModelConfig } from "@ngriffin_uk/polychat-schemas";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useLoadingActions } from "../state/LoadingContext.js";
import { useWebLLMModels } from "./useWebLLMModels.js";
import { WebLLMService } from "./web-llm.js";

/**
 * Hook for initializing WebLLM local models.
 * Handles model loading, progress tracking, and error states.
 */
export function useWebLLMInitialization(apiModels: ModelConfig = {}) {
  const { startLoading, updateLoading, stopLoading } = useLoadingActions();
  const { computeSite, model, setModel } = useChatStore();
  const webLLMModels = useWebLLMModels({ enabled: computeSite === "browser" });

  const [webLLMService] = useState(() => WebLLMService.getInstance());
  const [isInitializing, setIsInitializing] = useState(false);

  const matchingModel =
    model === null ? undefined : computeSite === "browser" ? webLLMModels[model] : apiModels[model];

  useEffect(() => {
    const loadingId = "model-init";
    let mounted = true;

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
    startLoading,
    updateLoading,
    stopLoading,
    setModel,
    webLLMService,
  ]);

  return {
    webLLMService: webLLMService,
    isInitializing,
  };
}

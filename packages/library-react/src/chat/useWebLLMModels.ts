import { deviceModelSource } from "@ngriffin_uk/polychat-library-chat";
import type { ModelConfig } from "@ngriffin_uk/polychat-schemas";
import { useEffect, useState } from "react";

import { getCachedWebLLMModels, loadWebLLMModels } from "./web-llm-models.js";

interface UseWebLLMModelsOptions {
  enabled?: boolean;
}

/**
 * A host with its own model runtimes runs them instead: the browser engine is the fallback for
 * surfaces that have no other way to keep a conversation on the machine.
 */
export function useWebLLMModels({ enabled = true }: UseWebLLMModelsOptions = {}) {
  const [models, setModels] = useState<ModelConfig>(() =>
    deviceModelSource() ? {} : getCachedWebLLMModels(),
  );

  useEffect(() => {
    if (!enabled || deviceModelSource()) {
      return;
    }

    let mounted = true;

    loadWebLLMModels()
      .then((loadedModels) => {
        if (mounted) {
          setModels(loadedModels);
        }
      })
      .catch((error: unknown) => {
        console.error("[useWebLLMModels] Failed to load WebLLM models:", error);
      });

    return () => {
      mounted = false;
    };
  }, [enabled]);

  return models;
}

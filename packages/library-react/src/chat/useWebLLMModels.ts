import { deviceModelSource } from "@ngriffin_uk/polychat-library-chat";
import type { ModelConfig } from "@ngriffin_uk/polychat-schemas";
import { useEffect, useState } from "react";

import { getCachedWebLLMModels, loadWebLLMModels } from "./web-llm-models.js";

interface UseWebLLMModelsOptions {
  enabled?: boolean;
}

export function useWebLLMModels({ enabled = true }: UseWebLLMModelsOptions = {}) {
  const [models, setModels] = useState<ModelConfig>(() =>
    deviceModelSource() ? {} : getCachedWebLLMModels(),
  );

  useEffect(() => {
    if (!enabled || deviceModelSource()) {
      return undefined;
    }

    let mounted = true;

    const load = async () => {
      try {
        const loadedModels = await loadWebLLMModels();

        if (mounted) {
          setModels(loadedModels);
        }
      } catch (error: unknown) {
        console.error("[useWebLLMModels] Failed to load WebLLM models:", error);
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [enabled]);

  return models;
}

import { clearModelResponseSettings } from "@ngriffin_uk/polychat-library-chat";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import { useCallback } from "react";

import { useWebLLMConsentStore } from "../state/stores/webLLMConsentStore.js";
import { getWebLLMModelDisplayName } from "./web-llm-models.js";

export function useBrowserModelConsent() {
  const pendingModelId = useWebLLMConsentStore((state) => state.pendingModelId);
  const setComputeSite = useChatStore((state) => state.setComputeSite);

  const confirmPendingBrowserModel = useCallback(() => {
    const pending = useWebLLMConsentStore.getState().pendingModelId;

    if (!pending) {
      return;
    }

    useWebLLMConsentStore.getState().confirmConsent(pending);

    const {
      setComputeSite: setSite,
      setModel: applyModel,
      setChatSettings: applySettings,
    } = useChatStore.getState();

    setSite("browser");
    applySettings(clearModelResponseSettings(useChatStore.getState().chatSettings));
    applyModel(pending);
  }, []);

  const cancelPendingBrowserModel = useCallback(() => {
    const pending = useWebLLMConsentStore.getState().pendingModelId;
    const { computeSite, model, setModel: resetModel } = useChatStore.getState();

    useWebLLMConsentStore.getState().cancelConsent();

    if (computeSite !== "hosted") {
      setComputeSite("hosted");
    }

    if (pending && model === pending && computeSite === "browser") {
      resetModel(null);
    }
  }, [setComputeSite]);

  return {
    pendingModelId,
    pendingModelName: pendingModelId ? getWebLLMModelDisplayName(pendingModelId) : null,
    confirmPendingBrowserModel,
    cancelPendingBrowserModel,
  };
}

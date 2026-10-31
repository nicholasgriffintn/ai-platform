import type { ChatRequestOptions } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import { mergeChatRequestOptions } from "@ngriffin_uk/polychat-library-chat/request-options";
import { useToolsStore, useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  useInstallAssistantRecipe,
  useInvokeAssistantRecipe,
  loadAssistantActionRequestOptions,
  parseAssistantActionLaunchState,
  createRecipeAssistantActionLaunch,
  readTeammateConversationLaunchIntent,
  readRecipeConversationLaunchIntent,
  removeConsumedAssistantActionLaunchParams,
} from "@ngriffin_uk/polychat-library-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";

import type { ThreadModeConfig } from "./index.js";

function hasConversationLaunch(search: string): boolean {
  const launch = parseAssistantActionLaunchState(search);

  return Boolean(
    launch.query ||
    launch.actionContext ||
    launch.autoSubmit ||
    launch.hasEnabledTools ||
    readRecipeConversationLaunchIntent(search) ||
    readTeammateConversationLaunchIntent(search),
  );
}

interface ResolvedConversationLaunch {
  autoSubmit?: { input: string; key: string };
  requestOptions?: ChatRequestOptions;
}

export function useConversationLaunchModeConfig(
  modeConfig?: ThreadModeConfig,
  pathConversationId?: string,
): ThreadModeConfig | undefined {
  const location = useLocation();
  const {
    clearCurrentConversation,
    initializeStore,
    setChatInput,
    setChatMode,
    setSelectedTeammateId,
    startNewConversation,
  } = useChatStore(
    useShallow((state) => ({
      clearCurrentConversation: state.clearCurrentConversation,
      initializeStore: state.initializeStore,
      setChatInput: state.setChatInput,
      setChatMode: state.setChatMode,
      setSelectedTeammateId: state.setSelectedTeammateId,
      startNewConversation: state.startNewConversation,
    })),
  );
  const setSelectedTools = useToolsStore((state) => state.setSelectedTools);
  const { mutateAsync: installRecipe } = useInstallAssistantRecipe();
  const { mutateAsync: invokeRecipe } = useInvokeAssistantRecipe();
  const [launch, setLaunch] = useState<ResolvedConversationLaunch>();
  const initialiseSequenceRef = useRef(0);

  const launchSearch = hasConversationLaunch(location.search) ? location.search : "";
  const launchKey = launchSearch ? location.key : "";

  useEffect(() => {
    const locationKey = `${launchKey}:${location.pathname}${launchSearch}`;
    const sequence = ++initialiseSequenceRef.current;
    const initialise = async () => {
      const completionId = pathConversationId;
      const urlLaunch = parseAssistantActionLaunchState(launchSearch);
      const recipeIntent = readRecipeConversationLaunchIntent(launchSearch);
      const launchTeammateId = readTeammateConversationLaunchIntent(launchSearch);

      if (!completionId) {
        clearCurrentConversation();
      }

      await initializeStore(completionId || undefined);
      if (initialiseSequenceRef.current !== sequence) {
        return;
      }

      if (launchTeammateId) {
        setSelectedTeammateId(launchTeammateId);
        setChatMode("agent");
      }

      let recipeLaunch: ReturnType<typeof createRecipeAssistantActionLaunch> | undefined;

      if (recipeIntent) {
        try {
          const projectId = modeConfig?.requestOptions?.metadata?.project_id;
          const response =
            recipeIntent.action === "setup"
              ? await installRecipe({ recipeId: recipeIntent.recipeId, projectId })
              : await invokeRecipe({ recipeId: recipeIntent.recipeId, projectId });

          if (initialiseSequenceRef.current !== sequence) {
            return;
          }

          recipeLaunch = createRecipeAssistantActionLaunch(response);
        } catch (error) {
          if (initialiseSequenceRef.current !== sequence) {
            return;
          }

          console.error(error);
          toast.error("Could not start recipe chat. Please try again.");

          return;
        }
      }

      const autoSubmitInput =
        recipeLaunch?.input ?? (urlLaunch.autoSubmit ? (urlLaunch.query ?? undefined) : undefined);

      if (autoSubmitInput) {
        startNewConversation();
        setChatInput("");
      } else if (urlLaunch.query) {
        setChatInput(urlLaunch.query);
      }

      if (recipeLaunch || urlLaunch.hasEnabledTools) {
        setSelectedTools(recipeLaunch?.enabledTools ?? urlLaunch.enabledTools);
      }

      setLaunch({
        ...(autoSubmitInput ? { autoSubmit: { input: autoSubmitInput, key: locationKey } } : {}),
        requestOptions:
          recipeLaunch?.requestOptions ?? loadAssistantActionRequestOptions(urlLaunch),
      });

      if (recipeLaunch || urlLaunch.autoSubmit || launchTeammateId) {
        const query = removeConsumedAssistantActionLaunchParams(window.location.search);
        const historyState =
          window.history.state && typeof window.history.state === "object"
            ? { ...window.history.state, usr: null }
            : {};

        window.history.replaceState(
          historyState,
          "",
          `${window.location.pathname}${query ? `?${query}` : ""}`,
        );
      }
    };

    void initialise();

    return () => {
      if (initialiseSequenceRef.current === sequence) {
        initialiseSequenceRef.current += 1;
      }
    };
  }, [
    clearCurrentConversation,
    initializeStore,
    installRecipe,
    launchKey,
    launchSearch,
    location.pathname,
    modeConfig?.requestOptions?.metadata?.project_id,
    pathConversationId,
    setChatInput,
    setChatMode,
    setSelectedTeammateId,
    setSelectedTools,
    startNewConversation,
    invokeRecipe,
  ]);

  return useMemo(() => {
    if (!launch?.autoSubmit && !launch?.requestOptions) {
      return modeConfig;
    }

    return {
      ...modeConfig,
      initialAutoSubmit: launch.autoSubmit ?? modeConfig?.initialAutoSubmit,
      requestOptions: mergeChatRequestOptions(modeConfig?.requestOptions, launch.requestOptions),
    };
  }, [launch, modeConfig]);
}

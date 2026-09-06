import { useToolsStore, useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  useStartRecipeConnector,
  useInstallAssistantRecipe,
  useInvokeAssistantRecipe,
  launchAssistantAction,
} from "@ngriffin_uk/polychat-library-react";
import type { AssistantActionResult } from "@ngriffin_uk/polychat-schemas";
import { toast } from "sonner";

interface UseAssistantActionSubmitOptions {
  projectId?: string;
  recipeManagementPath?: string;
}

export function useAssistantActionSubmit(options: UseAssistantActionSubmitOptions = {}) {
  const selectedAssistantAction = useChatStore((state) => state.selectedAssistantAction);
  const setSelectedAssistantAction = useChatStore((state) => state.setSelectedAssistantAction);
  const selectedTools = useToolsStore((state) => state.selectedTools);
  const setSelectedTools = useToolsStore((state) => state.setSelectedTools);
  const startConnector = useStartRecipeConnector();
  const installRecipe = useInstallAssistantRecipe();
  const invokeRecipe = useInvokeAssistantRecipe();

  const resolveAssistantActionSubmit = async (input: string): Promise<AssistantActionResult> => {
    const item = selectedAssistantAction?.item;

    if (!item) {
      return { kind: "submit", input };
    }

    const verb = selectedAssistantAction?.verb;
    const result = await launchAssistantAction(
      {
        delivery: "submit",
        input,
        item,
        ...(options.recipeManagementPath
          ? { recipeManagementPath: options.recipeManagementPath }
          : {}),
        selectedTools,
        ...(verb ? { verb: { command: verb, id: verb } } : {}),
      },
      {
        installRecipe: (recipeId) =>
          installRecipe.mutateAsync({
            recipeId,
            ...(options.projectId ? { projectId: options.projectId } : {}),
          }),
        invokeRecipe: (recipeId, recipeInput) =>
          invokeRecipe.mutateAsync({
            recipeId,
            input: recipeInput,
            ...(options.projectId ? { projectId: options.projectId } : {}),
          }),
        startConnector: (provider, returnTo) => startConnector.mutateAsync({ provider, returnTo }),
      },
    );

    if (result.notification?.type === "error") {
      toast.error(result.notification.message);
    }

    if (result.selectedTools) {
      setSelectedTools(result.selectedTools);
    }

    setSelectedAssistantAction(null);

    return result;
  };

  return {
    resolveAssistantActionSubmit,
  };
}

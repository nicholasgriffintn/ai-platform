import type { ComposerCommandAction } from "@ngriffin_uk/polychat-component-conversation";
import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { useMemo } from "react";

import { isSelectableHomeChatModeId } from "~/components/Home/chatModes";
import type { SelectableHomeChatModeId } from "~/components/Home/chatModes";
import type {
  ChatSuggestionConnector,
  ChatSuggestionContext,
  ChatSuggestionRecipe,
} from "~/lib/chat-suggestions";
import { resolveFocusRole } from "~/lib/focus-role";
import { useChatStore } from "~/state/stores/chatStore";

import { useRecipeConnectors } from "./useConnectors";
import { useAssistantRecipes, useRecipeInstallations } from "./useRecipes";
import { useTools } from "./useTools";

const MAX_CONNECTOR_SIGNALS = 3;
const MAX_RECIPE_SIGNALS = 2;

interface ChatSuggestionContextOptions {
  enabled: boolean;
  includeCapabilities: boolean;
  modeCommands?: ComposerCommandAction[];
  modelConfig?: ModelConfigItem;
}

function resolveAvailableModes(
  modeCommands: ComposerCommandAction[] | undefined,
): SelectableHomeChatModeId[] {
  return (modeCommands ?? [])
    .filter((command) => !command.disabled && !command.isActive)
    .map((command) => command.id)
    .filter(isSelectableHomeChatModeId)
    .filter((modeId) => modeId !== "chat");
}

export function useChatSuggestionContext({
  enabled,
  includeCapabilities,
  modeCommands,
  modelConfig,
}: ChatSuggestionContextOptions): {
  context: ChatSuggestionContext;
  isLoading: boolean;
} {
  const wantsCapabilities = enabled && includeCapabilities;
  const userSettings = useChatStore((state) => state.userSettings);
  const { data: toolsData, isLoading: isLoadingTools } = useTools({ enabled: wantsCapabilities });
  const { data: connectorsData, isLoading: isLoadingConnectors } = useRecipeConnectors({
    enabled: wantsCapabilities,
  });
  const { data: installationsData, isLoading: isLoadingInstallations } = useRecipeInstallations(
    undefined,
    { enabled: wantsCapabilities },
  );
  const { data: recipesData, isLoading: isLoadingRecipes } = useAssistantRecipes({
    enabled: wantsCapabilities,
  });

  const availableToolIds = useMemo(() => {
    if (!wantsCapabilities || modelConfig?.supportsToolCalls === false) {
      return [];
    }

    return (toolsData ?? []).map((tool) => tool.id);
  }, [modelConfig?.supportsToolCalls, toolsData, wantsCapabilities]);

  const connectors = useMemo<ChatSuggestionConnector[]>(() => {
    if (!wantsCapabilities) {
      return [];
    }

    return (connectorsData?.connectors ?? [])
      .filter((connector) => connector.status === "connected")
      .slice(0, MAX_CONNECTOR_SIGNALS)
      .map((connector) => ({ id: connector.id, name: connector.name }));
  }, [connectorsData, wantsCapabilities]);

  const recipes = useMemo<ChatSuggestionRecipe[]>(() => {
    if (!wantsCapabilities) {
      return [];
    }

    const titles = new Map((recipesData?.recipes ?? []).map((recipe) => [recipe.id, recipe.title]));

    return (installationsData?.installations ?? [])
      .filter((installation) => installation.status === "active" && !installation.projectId)
      .map((installation) => ({
        id: installation.recipeId,
        title: titles.get(installation.recipeId),
      }))
      .filter((recipe): recipe is ChatSuggestionRecipe => Boolean(recipe.title))
      .slice(0, MAX_RECIPE_SIGNALS);
  }, [installationsData, recipesData, wantsCapabilities]);

  const context = useMemo<ChatSuggestionContext>(
    () => ({
      focusRole: enabled ? resolveFocusRole(userSettings?.job_role) : null,
      availableModes: wantsCapabilities ? resolveAvailableModes(modeCommands) : [],
      availableToolIds,
      connectors,
      recipes,
    }),
    [
      availableToolIds,
      connectors,
      enabled,
      modeCommands,
      recipes,
      userSettings?.job_role,
      wantsCapabilities,
    ],
  );

  return {
    context,
    isLoading:
      wantsCapabilities &&
      (isLoadingTools || isLoadingConnectors || isLoadingInstallations || isLoadingRecipes),
  };
}

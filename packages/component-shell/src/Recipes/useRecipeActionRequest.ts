import type { AssistantRecipe, RecipeInstallation } from "@ngriffin_uk/polychat-schemas";
import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router";

interface RecipeActionRequestHandlers {
  openConfigurationDialog: (recipe: AssistantRecipe, installation?: RecipeInstallation) => void;
  openScheduleDialog: (recipe: AssistantRecipe, installation?: RecipeInstallation) => void;
}

export function useRecipeActionRequest(
  recipes: AssistantRecipe[],
  installationByRecipeId: ReadonlyMap<string, RecipeInstallation>,
  actions: RecipeActionRequestHandlers,
) {
  const [searchParams, setSearchParams] = useSearchParams();
  const handledActionRef = useRef<string | null>(null);

  useEffect(() => {
    const requestedAction = searchParams.get("action");

    if (requestedAction !== "configure" && requestedAction !== "schedule") {
      if (!requestedAction) {
        handledActionRef.current = null;
      }

      return;
    }

    const recipeId = searchParams.get("recipe");
    const recipe = recipeId ? recipes.find((item) => item.id === recipeId) : undefined;

    if (!recipe) {
      return;
    }

    const actionKey = `${requestedAction}:${recipe.id}`;

    if (handledActionRef.current === actionKey) {
      return;
    }

    handledActionRef.current = actionKey;

    const nextSearchParams = new URLSearchParams(searchParams);

    nextSearchParams.delete("action");
    nextSearchParams.delete("recipe");
    setSearchParams(nextSearchParams, { replace: true });

    const installation = installationByRecipeId.get(recipe.id);

    if (requestedAction === "configure") {
      actions.openConfigurationDialog(recipe, installation);
    } else {
      actions.openScheduleDialog(recipe, installation);
    }
  }, [actions, installationByRecipeId, recipes, searchParams, setSearchParams]);
}

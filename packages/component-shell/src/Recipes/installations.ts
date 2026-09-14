import type { RecipeInstallation } from "@ngriffin_uk/polychat-schemas";
import { areUserIdsEqual } from "@ngriffin_uk/polychat-utility-core";

export function buildOwnInstallationByRecipeId(
  installations: readonly RecipeInstallation[],
  currentUserId?: string | number,
): Map<string, RecipeInstallation> {
  return new Map(
    installations
      .filter((installation) => areUserIdsEqual(installation.userId, currentUserId))
      .map((installation) => [installation.recipeId, installation]),
  );
}

export function findOwnInstallation(
  installations: readonly RecipeInstallation[],
  recipeId: string,
  currentUserId?: string | number,
): RecipeInstallation | undefined {
  return buildOwnInstallationByRecipeId(installations, currentUserId).get(recipeId);
}

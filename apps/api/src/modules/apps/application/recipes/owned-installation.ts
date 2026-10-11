import { ownsResource } from "@ngriffin_uk/polychat-library-policy";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { parseJsonRecord } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

import { getRecipeById } from "./catalog";

export async function requireOwnedRecipeInstallation(params: {
  context: ServiceContext;
  userId: number;
  installationId: string;
}) {
  params.context.ensureDatabase();
  const record = await params.context.repositories.templates.getTemplateById(params.installationId);

  if (
    !record ||
    record.kind !== "recipe" ||
    !ownsResource(params.userId, record.created_by_user_id) ||
    record.status === "archived"
  ) {
    throw new AssistantError("Recipe installation not found", ErrorType.NOT_FOUND, 404);
  }

  if (record.project_id) {
    await requireProjectAccess(params.context, record.project_id);
  }

  const stored = parseJsonRecord(record.configuration);
  const recipeId = typeof stored.recipeId === "string" ? stored.recipeId : record.capability_id;
  const recipe = recipeId ? getRecipeById(recipeId) : undefined;

  if (!recipe || !recipeId) {
    throw new AssistantError("Recipe installation is invalid", ErrorType.PARAMS_ERROR, 400);
  }

  return { record, recipe, recipeId };
}

import type { RecipeInvocationResponse } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { requireSystemModel, type ResolvedSystemModel } from "~/modules/models/application/resolve";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";
import type { IUser } from "~/types";

import { getRecipeById } from "./catalog";

export async function resolveRecipeModel(
  context: ServiceContext,
  user: IUser,
  invocation: Pick<RecipeInvocationResponse, "recipeId">,
  projectId?: string,
): Promise<ResolvedSystemModel> {
  const project = projectId
    ? await context.repositories.get(WorkspaceRepository).getProject(projectId)
    : null;

  return requireSystemModel(
    context.env,
    user,
    getRecipeById(invocation.recipeId)?.modelRole ?? "routines",
    { workspaceId: project?.workspace_id },
  );
}

import { recipeChatRequestOptionsSchema } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import {
  getRecipeById,
  parseRecipeInstallationRecord,
  requireEnabledProjectRecipe,
} from "~/services/apps/recipes";
import {
  buildRecipeConnections,
  buildRecipeInvocationRuntime,
} from "~/services/apps/recipes/runtime";
import { requireProjectAccess } from "~/services/workspaces/access";

import {
  rejectConnectorApprovalAuthority,
  type ConnectorApprovalExecutionAuthority,
} from "./connector-approval-authority";

export async function buildConnectorApprovalRecipeContext(params: {
  context: ServiceContext;
  userId: number;
  channel: string;
  recipeId?: string;
  installationId?: string;
  projectId?: string;
  teammateContextId?: string;
}): Promise<
  Pick<ConnectorApprovalExecutionAuthority, "requestOptions" | "projectId" | "teammateContextId">
> {
  if (params.projectId) {
    await requireProjectAccess(params.context, params.projectId);
  }

  if (!params.recipeId) {
    if (params.channel !== "web" || params.installationId) {
      rejectConnectorApprovalAuthority();
    }

    return {
      requestOptions: {},
      ...(params.projectId ? { projectId: params.projectId } : {}),
      ...(params.teammateContextId ? { teammateContextId: params.teammateContextId } : {}),
    };
  }

  const recipe = getRecipeById(params.recipeId);

  if (!recipe) {
    rejectConnectorApprovalAuthority();
  }

  if (params.projectId) {
    await requireEnabledProjectRecipe(params.context, params.projectId, recipe.id);
  }

  let installation = null;

  if (params.installationId) {
    const record = await params.context.repositories.templates.getTemplateById(
      params.installationId,
    );

    installation = record ? parseRecipeInstallationRecord(record) : null;

    if (
      !installation ||
      installation.status !== "active" ||
      installation.userId !== params.userId ||
      installation.recipeId !== recipe.id ||
      installation.id !== params.installationId ||
      installation.projectId !== params.projectId ||
      installation.teammateContextId !== params.teammateContextId
    ) {
      rejectConnectorApprovalAuthority();
    }
  }

  const runtime = buildRecipeInvocationRuntime({
    recipe,
    connections: buildRecipeConnections(recipe),
    installation,
    configuration: installation?.configuration,
  });
  const channel = recipeChatRequestOptionsSchema.shape.channel.safeParse(params.channel);

  if (!channel.success || channel.data === undefined) {
    rejectConnectorApprovalAuthority();
  }

  return {
    requestOptions: {
      recipe: {
        id: recipe.id,
        ...(installation ? { installationId: installation.id } : {}),
        channel: channel.data,
        allowedConnectorProviders: runtime.allowedConnectorProviders,
        allowedConnectorOperations: runtime.allowedConnectorOperations,
        ...(installation?.configuration ? { configuration: installation.configuration } : {}),
      },
    },
    ...(params.projectId ? { projectId: params.projectId } : {}),
    ...(params.teammateContextId ? { teammateContextId: params.teammateContextId } : {}),
  };
}

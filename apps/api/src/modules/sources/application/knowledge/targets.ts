import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { requireNotebookAccess } from "~/modules/notebooks/application/access";
import type { KnowledgeTarget } from "~/modules/sources/domain/knowledge/item";
import {
  requireProjectAccess,
  requireProjectCapabilityAccess,
} from "~/modules/workspaces/application/access";

export interface KnowledgeDestination {
  projectId: string | null;
  notebookId: string | null;
}

export interface KnowledgeTargetOptions {
  manage: boolean;
  connectorRecipeId?: string;
}

function notFound(): AssistantError {
  return new AssistantError("Knowledge destination not found", ErrorType.NOT_FOUND, 404);
}

export async function requireKnowledgeTarget(
  context: ServiceContext,
  destination: KnowledgeDestination,
  options: KnowledgeTargetOptions,
): Promise<KnowledgeTarget> {
  const userId = context.requireUser().id;

  if (destination.notebookId) {
    const { notebook } = await requireNotebookAccess(context, destination.notebookId, {
      manage: options.manage,
    });

    if (
      (destination.projectId && notebook.project_id !== destination.projectId) ||
      (options.connectorRecipeId && notebook.project_id)
    ) {
      throw notFound();
    }

    return { userId, projectId: notebook.project_id, collectionIds: [notebook.id] };
  }

  if (!destination.projectId) {
    if (options.connectorRecipeId) {
      throw notFound();
    }

    return { userId, projectId: null, collectionIds: [] };
  }

  await requireProjectAccess(
    context,
    destination.projectId,
    options.manage ? ["owner", "admin"] : ["owner", "admin", "member"],
  );

  if (options.connectorRecipeId) {
    await requireProjectCapabilityAccess(
      context,
      destination.projectId,
      "recipe",
      options.connectorRecipeId,
    );
  }

  return { userId, projectId: destination.projectId, collectionIds: [] };
}

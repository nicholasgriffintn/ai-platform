import { ownsResource } from "@ngriffin_uk/polychat-library-policy";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  NotebookRepository,
  type NotebookRecord,
} from "~/modules/notebooks/infrastructure/NotebookRepository";
import { requireProjectAccess } from "~/modules/workspaces/application/access";

export interface NotebookAccess {
  notebook: NotebookRecord;
  canManage: boolean;
}

function notFound(): AssistantError {
  return new AssistantError("Notebook not found", ErrorType.NOT_FOUND, 404);
}

export async function requireNotebookAccess(
  context: ServiceContext,
  notebookId: string,
  options: { manage?: boolean } = {},
): Promise<NotebookAccess> {
  const user = context.requireUser();
  const notebook = await context.repositories.get(NotebookRepository).getNotebook(notebookId);

  if (!notebook) {
    throw notFound();
  }

  if (!notebook.project_id) {
    if (!ownsResource(user.id, notebook.owner_user_id)) {
      throw notFound();
    }

    return { notebook, canManage: true };
  }

  const { role } = await requireProjectAccess(
    context,
    notebook.project_id,
    options.manage ? ["owner", "admin"] : ["owner", "admin", "member"],
  );

  return { notebook, canManage: role === "owner" || role === "admin" };
}

export async function findNotebookAccess(
  context: ServiceContext,
  notebookId: string,
): Promise<NotebookAccess | null> {
  try {
    return await requireNotebookAccess(context, notebookId);
  } catch (error) {
    if (
      error instanceof AssistantError &&
      (error.type === ErrorType.NOT_FOUND || error.type === ErrorType.FORBIDDEN)
    ) {
      return null;
    }

    throw error;
  }
}

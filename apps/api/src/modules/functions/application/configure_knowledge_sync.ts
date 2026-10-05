import { createKnowledgeSyncSchema } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { getActiveRecipeSetup } from "~/modules/apps/application/recipes/toolContext";
import { createKnowledgeSync } from "~/modules/sources/application/knowledge-sync";
import type { ApiToolDefinition } from "~/types/functions";

import { configure_knowledge_sync as descriptor } from "./definitions/configure_knowledge_sync";
import { resolveRequestProjectId } from "./request-context";

export const configure_knowledge_sync: ApiToolDefinition = {
  ...descriptor,
  execute: async (args, { request }) => {
    if (!request.context) {
      throw new AssistantError(
        "Sign in to configure knowledge sync",
        ErrorType.AUTHENTICATION_ERROR,
        401,
      );
    }

    const input = createKnowledgeSyncSchema.parse(args);
    const projectId = resolveRequestProjectId(request);

    if (
      !projectId ||
      projectId !== input.projectId ||
      getActiveRecipeSetup(request.request?.options)?.id !== input.recipeId
    ) {
      throw new AssistantError(
        "Configure knowledge sync within the destination project",
        ErrorType.AUTHORISATION_ERROR,
        403,
      );
    }

    const sync = await createKnowledgeSync(request.context, input);

    return {
      status: "success",
      name: "configure_knowledge_sync",
      content: "Knowledge sync saved. Review freshness or pause the sync in project Files.",
      data: sync,
    };
  },
};

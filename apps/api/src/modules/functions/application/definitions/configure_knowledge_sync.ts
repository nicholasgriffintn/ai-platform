import { createKnowledgeSyncSchema } from "@ngriffin_uk/polychat-schemas";

import type { FunctionToolDescriptor } from "./types";

export const configure_knowledge_sync: FunctionToolDescriptor = {
  name: "configure_knowledge_sync",
  type: "normal",
  permissions: ["write"],
  description:
    "Save a recurring selected-resource sync for a recipe integration with a knowledge adapter. Discover and test its exact read parameters with use_recipe_connector first; pass its connectionReferenceId as connectionId, and the active recipe and integration IDs. Copied text becomes available to project members.",
  inputSchema: createKnowledgeSyncSchema,
  intentEvidence: (input) => ({
    operation: "create_knowledge_sync",
    scope: "project",
    projectId: input.projectId,
  }),
};

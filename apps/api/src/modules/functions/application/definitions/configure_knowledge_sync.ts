import { createKnowledgeSyncSchema } from "@ngriffin_uk/polychat-schemas";

import type { FunctionToolDescriptor } from "./types";

export const configure_knowledge_sync: FunctionToolDescriptor = {
  name: "configure_knowledge_sync",
  type: "normal",
  permissions: ["write"],
  description:
    "Save a recurring selected-page Confluence sync into project Files after the user chooses the pages, account and interval. Discover and test the exact page read parameters with use_recipe_connector first; pass its connectionReferenceId as connectionId. Page text becomes available to project members.",
  inputSchema: createKnowledgeSyncSchema,
  intentEvidence: (input) => ({
    operation: "create_knowledge_sync",
    scope: "project",
    projectId: input.projectId,
  }),
};

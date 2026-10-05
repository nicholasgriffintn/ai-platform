import { createKnowledgeSyncSchema } from "@ngriffin_uk/polychat-schemas";

import type { FunctionToolDescriptor } from "./types";

export const configure_knowledge_sync: FunctionToolDescriptor = {
  name: "configure_knowledge_sync",
  type: "normal",
  permissions: ["write"],
  effects: { effectClass: "write" },
  description:
    "Save a recurring selected-resource sync through a connected recipe integration. Discover and test each resource's read operation and parameters with use_recipe_connector first. Map the actual response fields for identity, title and content, including any response envelope in each path. Use '*' in content paths to collect text from arrays. Select text, HTML or UTF-8 base64 content; optionally map revision, URL, URL base and available/archive states. Pass the discovery connectionReferenceId as connectionId and the active recipe and integration IDs. Copied text becomes available to project members.",
  inputSchema: createKnowledgeSyncSchema,
  intentEvidence: (input) => ({
    operation: "create_knowledge_sync",
    scope: "project",
    projectId: input.projectId,
  }),
};

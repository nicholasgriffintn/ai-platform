import { createConnectorKnowledgeSyncSchema } from "@ngriffin_uk/polychat-schemas";

import type { FunctionToolDescriptor } from "~/types/functions";

export const configure_knowledge_sync: FunctionToolDescriptor = {
  name: "configure_knowledge_sync",
  type: "normal",
  permissions: ["write"],
  effects: { effectClass: "write" },
  description:
    "Save a recurring sync that files documents from a connected recipe integration. Prefer a catalogued document type: pass resources as { resourceId, title, descriptor: { id, parameters } } using a descriptor from the knowledge_descriptors list for that service, such as notion-database, google-drive-docs, gmail-search, slack-channel, github-issues, linear-issues or jira-search. Each upstream item then becomes its own document, unchanged items are skipped and removed items are archived. Only when no descriptor fits, discover and test a read operation with use_recipe_connector and map identity, title and content paths yourself, including any response envelope; use '*' to collect text from arrays or object values. Pass the discovery connectionReferenceId as connectionId and the active recipe and integration IDs. Pass projectId to sync into the current project, where copied text becomes available to project members, or notebookId to sync into the current personal notebook.",
  inputSchema: createConnectorKnowledgeSyncSchema,
  intentEvidence: (input) => ({
    operation: "create_knowledge_sync",
    scope: input.projectId ? "project" : "notebook",
    projectId: input.projectId,
    notebookId: input.notebookId,
  }),
};

import {
  artifactBindingReadRequestSchema,
  artifactBindingReadResponseSchema,
  conversationParamsSchema,
  errorResponseSchema,
} from "@ngriffin_uk/polychat-schemas";

import type { ResourceBuilder } from "~/infrastructure/http/resource";

import { readArtifactBinding } from "../application/artifact-bindings";

export function defineConversationArtifactBindings(conversations: ResourceBuilder): void {
  conversations.sub("artifact_bindings", "binding_id").collectionAction("read", {
    auth: true,
    cache: "no-store",
    summary: "Read an artifact's declared data source",
    description:
      "Runs one read-only data source that an artifact declared when it was written. The declaration is read from the stored item, so the caller only names it.",
    paramSchema: conversationParamsSchema,
    bodySchema: artifactBindingReadRequestSchema,
    responses: {
      200: {
        description: "The data source's latest result",
        schema: artifactBindingReadResponseSchema,
      },
      403: { description: "The data source would change something", schema: errorResponseSchema },
      404: { description: "Data source not found", schema: errorResponseSchema },
      429: { description: "Read too often", schema: errorResponseSchema },
    },
    handler: ({ serviceContext, params, body }) =>
      readArtifactBinding(serviceContext, params.conversation_id, body),
  });
}

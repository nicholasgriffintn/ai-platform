import {
  conversationParamsSchema,
  errorResponseSchema,
  secretRequestSubmissionSchema,
  submitSecretRequestSchema,
} from "@ngriffin_uk/polychat-schemas";

import type { ResourceBuilder } from "~/infrastructure/http/resource";

import { submitSecretRequest } from "../application/secret-requests";

export function defineConversationSecretRequests(conversations: ResourceBuilder): void {
  conversations.sub("secret_requests", "interaction_id").create({
    auth: true,
    summary: "Provide a requested secret",
    description:
      "Stores a secret the assistant asked for and returns a one-use reference. The value never enters the conversation.",
    paramSchema: conversationParamsSchema,
    bodySchema: submitSecretRequestSchema,
    responses: {
      200: { description: "The secret reference", schema: secretRequestSubmissionSchema },
      409: { description: "The request is no longer waiting", schema: errorResponseSchema },
    },
    handler: ({ serviceContext, params, body }) =>
      submitSecretRequest(serviceContext, params.conversation_id, body),
  });
}

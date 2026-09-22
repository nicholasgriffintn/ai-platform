import {
  conversationThreadsResponseSchema,
  getChatCompletionMessagesResponseSchema,
  getChatCompletionParamsSchema,
  getMessageResponseSchema,
  errorResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import type { Context, Hono } from "hono";
import z from "zod/v4";

import { getServiceContext } from "~/infrastructure/context/serviceContext";
import { ResponseFactory } from "~/infrastructure/http/ResponseFactory";
import { addRoute } from "~/infrastructure/http/routeBuilder";
import { getConversationBranches } from "~/modules/completions/application/conversationThreads";
import {
  handleGetChatMessageById,
  handleGetChatMessages,
} from "~/modules/completions/application/getChatMessages";

const chatMessageListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    after: z.string().optional(),
    before: z.string().optional(),
  })
  .refine(({ after, before }) => !(after && before), {
    message: "Use either after or before, not both",
  });

export function registerConversationHistoryRoutes(app: Hono): void {
  addRoute(app, "get", "/completions/:completion_id/threads", {
    auth: true,
    tags: ["chat"],
    summary: "List the authorised conversation branch family",
    paramSchema: getChatCompletionParamsSchema,
    responses: {
      200: { description: "Conversation threads", schema: conversationThreadsResponseSchema },
    },
    handler: ({ serviceContext, params }) =>
      getConversationBranches(serviceContext, params.completion_id),
  });

  addRoute(app, "get", "/completions/:completion_id/messages", {
    tags: ["chat"],
    summary: "Get chat messages",
    description:
      "Get the messages in a stored chat completion. Only chat completions that have been created with the store parameter set to true will be returned.",
    paramSchema: getChatCompletionParamsSchema,
    querySchema: chatMessageListQuerySchema,
    responses: {
      200: {
        description: "Messages for the specified chat completion",
        schema: getChatCompletionMessagesResponseSchema,
      },
      400: {
        description: "Bad request or validation error",
        schema: errorResponseSchema,
      },
      404: { description: "Completion not found", schema: errorResponseSchema },
    },
    handler: async ({ raw }) =>
      (async (context: Context) => {
        const { completion_id } = context.req.valid("param" as never) as {
          completion_id: string;
        };
        const { limit, after, before } = context.req.valid("query" as never) as z.infer<
          typeof chatMessageListQuerySchema
        >;

        const anonymousUser = context.get("anonymousUser");

        const serviceContext = getServiceContext(context);

        const { messages, conversation_id, has_more, oldest_message_id } =
          await handleGetChatMessages(
            serviceContext,
            anonymousUser,
            completion_id,
            limit,
            after,
            before,
          );

        return ResponseFactory.success(context, {
          messages,
          conversation_id,
          has_more,
          oldest_message_id,
        });
      })(raw),
  });

  addRoute(app, "get", "/completions/messages/:message_id", {
    tags: ["chat"],
    summary: "Get message",
    description: "Get a single message by ID",
    responses: {
      200: {
        description: "Message details with conversation ID",
        schema: getMessageResponseSchema,
      },
      400: {
        description: "Bad request or validation error",
        schema: errorResponseSchema,
      },
      404: { description: "Message not found", schema: errorResponseSchema },
    },
    handler: async ({ raw }) =>
      (async (context: Context) => {
        const { message_id } = context.req.param();
        const anonymousUser = context.get("anonymousUser");

        const serviceContext = getServiceContext(context);

        const { message, conversation_id } = await handleGetChatMessageById(
          serviceContext,
          anonymousUser,
          message_id,
        );

        return ResponseFactory.success(context, {
          ...message,
          conversation_id,
        });
      })(raw),
  });
}

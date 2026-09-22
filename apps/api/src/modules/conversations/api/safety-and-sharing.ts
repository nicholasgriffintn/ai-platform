import {
  checkChatCompletionJsonSchema,
  checkChatCompletionParamsSchema,
  getSharedConversationParamsSchema,
  shareConversationParamsSchema,
  submitChatCompletionFeedbackJsonSchema,
  submitChatCompletionFeedbackParamsSchema,
  unshareConversationParamsSchema,
  errorResponseSchema,
  messageSchema,
  type SubmitChatCompletionFeedbackInput,
} from "@ngriffin_uk/polychat-schemas";
import type { Context, Hono } from "hono";
import z from "zod/v4";

import { getServiceContext } from "~/infrastructure/context/serviceContext";
import { ResponseFactory } from "~/infrastructure/http/ResponseFactory";
import { addRoute } from "~/infrastructure/http/routeBuilder";
import { validateCaptcha } from "~/middleware/captchaMiddleware";
import { handleCheckChatCompletion } from "~/modules/completions/application/checkChatCompletion";
import { handleGetSharedConversation } from "~/modules/completions/application/getSharedConversation";
import { handleShareConversation } from "~/modules/completions/application/shareConversation";
import { handleUnshareConversation } from "~/modules/completions/application/unshareConversation";
import { submitConversationFeedback } from "~/modules/conversations/application/feedback-submission";
import type { ChatRole } from "~/types";

const sharedChatMessageListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  after: z.string().optional(),
});

export function registerConversationSafetyAndSharingRoutes(app: Hono): void {
  addRoute(app, "post", "/completions/:completion_id/check", {
    tags: ["chat", "guardrails"],
    description: "Check a chat against guardrails",
    bodySchema: checkChatCompletionJsonSchema,
    paramSchema: checkChatCompletionParamsSchema,
    responses: {
      200: {
        description: "Guardrail check results",
        schema: z.object({
          response: z.object({
            status: z.string(),
            flagged: z.boolean(),
            reasons: z.array(z.string()).optional(),
            category: z.array(z.string()).optional(),
          }),
        }),
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
        const { role } = context.req.valid("json" as never) as {
          role: ChatRole;
        };

        const serviceContext = getServiceContext(context);

        const response = await handleCheckChatCompletion(serviceContext, completion_id, role);

        return ResponseFactory.success(context, {
          response,
        });
      })(raw),
  });

  addRoute(app, "post", "/completions/:completion_id/feedback", {
    tags: ["chat"],
    summary: "Submit feedback about a chat completion",
    auth: true,
    bodySchema: submitChatCompletionFeedbackJsonSchema,
    paramSchema: submitChatCompletionFeedbackParamsSchema,
    responses: {
      200: {
        description: "Feedback submission status",
        schema: z.object({
          response: z.object({
            status: z.string(),
            message: z.string(),
          }),
        }),
      },
      400: {
        description: "Bad request or validation error",
        schema: errorResponseSchema,
      },
      404: { description: "Completion not found", schema: errorResponseSchema },
    },
    middleware: [validateCaptcha],
    handler: async ({ raw }) =>
      (async (context: Context) => {
        const { completion_id } = context.req.valid("param" as never) as {
          completion_id: string;
        };
        const body = context.req.valid("json" as never) as SubmitChatCompletionFeedbackInput;

        const response = await submitConversationFeedback(
          getServiceContext(context),
          completion_id,
          body,
        );

        return ResponseFactory.success(context, {
          response,
        });
      })(raw),
  });

  addRoute(app, "post", "/completions/:completion_id/share", {
    tags: ["chat"],
    summary: "Share a conversation publicly",
    description: "Make a conversation publicly accessible via a unique share link",
    paramSchema: shareConversationParamsSchema,
    responses: {
      200: {
        description: "Share ID for accessing the conversation",
        schema: z.object({
          share_id: z.string(),
        }),
      },
      400: {
        description: "Bad request or validation error",
        schema: errorResponseSchema,
      },
      404: { description: "Completion not found", schema: errorResponseSchema },
    },
    middleware: [validateCaptcha],
    handler: async ({ raw }) =>
      (async (context: Context) => {
        const { completion_id } = context.req.valid("param" as never) as {
          completion_id: string;
        };

        const serviceContext = getServiceContext(context);

        const result = await handleShareConversation(serviceContext, completion_id);

        return ResponseFactory.success(context, result);
      })(raw),
  });

  addRoute(app, "delete", "/completions/:completion_id/share", {
    tags: ["chat"],
    summary: "Unshare a conversation",
    description: "Make a previously shared conversation private",
    paramSchema: unshareConversationParamsSchema,
    responses: {
      200: {
        description: "Unshare operation result",
        schema: z.object({
          success: z.boolean(),
        }),
      },
      400: {
        description: "Bad request or validation error",
        schema: errorResponseSchema,
      },
      404: {
        description: "Completion or share not found",
        schema: errorResponseSchema,
      },
    },
    handler: async ({ raw }) =>
      (async (context: Context) => {
        const { completion_id } = context.req.valid("param" as never) as {
          completion_id: string;
        };

        const serviceContext = getServiceContext(context);

        const result = await handleUnshareConversation(serviceContext, completion_id);

        return ResponseFactory.success(context, result);
      })(raw),
  });

  addRoute(app, "get", "/shared/:share_id", {
    tags: ["chat"],
    summary: "Access a shared conversation",
    description: "Get messages from a publicly shared conversation using its share ID",
    paramSchema: getSharedConversationParamsSchema,
    querySchema: sharedChatMessageListQuerySchema,
    responses: {
      200: {
        description: "Shared conversation messages",
        schema: z.object({
          messages: z.array(messageSchema),
          share_id: z.string(),
        }),
      },
      400: {
        description: "Bad request or validation error",
        schema: errorResponseSchema,
      },
      404: {
        description: "Shared conversation not found",
        schema: errorResponseSchema,
      },
    },
    handler: async ({ raw }) =>
      (async (context: Context) => {
        const { share_id } = context.req.valid("param" as never) as {
          share_id: string;
        };
        const { limit, after } = context.req.valid("query" as never) as z.infer<
          typeof sharedChatMessageListQuerySchema
        >;

        const serviceContext = getServiceContext(context);

        const result = await handleGetSharedConversation(serviceContext, share_id, limit, after);

        return ResponseFactory.success(context, result);
      })(raw),
  });
}

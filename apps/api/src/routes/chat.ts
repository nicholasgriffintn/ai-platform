import {
  conversationBranchesResponseSchema,
  cancelChatCompletionResponseSchema,
  compactChatCompletionResponseSchema,
  goalResponseSchema,
  setGoalRequestSchema,
  updateGoalRequestSchema,
  chatCompletionResponseSchema,
  editCompletionResponseSchema,
  checkChatCompletionJsonSchema,
  checkChatCompletionParamsSchema,
  bulkArchiveChatCompletionsJsonSchema,
  bulkArchiveChatCompletionsResponseSchema,
  conversationArchiveFilterSchema,
  conversationSortBySchema,
  conversationTypeSchema,
  countTokensJsonSchema,
  countTokensResponseSchema,
  createChatCompletionsJsonSchema,
  nextEditRequestSchema,
  applyEditRequestSchema,
  deleteChatCompletionParamsSchema,
  fillInMiddleRequestSchema,
  fillInMiddleResponseSchema,
  generateChatCompletionTitleJsonSchema,
  generateChatCompletionTitleParamsSchema,
  getChatCompletionMessagesResponseSchema,
  getChatCompletionParamsSchema,
  getChatCompletionResponseSchema,
  getMessageResponseSchema,
  getSharedConversationParamsSchema,
  shareConversationParamsSchema,
  submitChatCompletionFeedbackJsonSchema,
  submitChatCompletionFeedbackParamsSchema,
  unshareConversationParamsSchema,
  updateChatCompletionJsonSchema,
  updateChatCompletionParamsSchema,
  errorResponseSchema,
  chatRunParamsSchema,
  chatRunCommandParamsSchema,
  chatRunCommandReceiptResponseSchema,
  chatRunRecoveryResponseSchema,
  chatRunReplayQuerySchema,
  chatRunReplayResponseSchema,
  chatRunSnapshotResponseSchema,
  cancelChatRunRequestSchema,
  messageSchema,
  type ChatCompletionRequestBody,
  type SubmitChatCompletionFeedbackInput,
} from "@ngriffin_uk/polychat-schemas";
import { type Context, Hono, type Next } from "hono";
import z from "zod/v4";

import {
  countAssistantMessages,
  recordTurnRecoveryAttempt,
} from "~/lib/chat/streaming/continuity-telemetry";
import {
  recoveryTelemetryQueryFields,
  validateRecoveryTelemetryQuery,
} from "~/lib/chat/streaming/recovery-telemetry-query";
import { requireCloudflareExecutionContext } from "~/lib/cloudflare/execution-context";
import { getServiceContext } from "~/lib/context/serviceContext";
import { ConversationManager } from "~/lib/conversationManager";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import { addRoute } from "~/lib/http/routeBuilder";
import { sseResponse } from "~/lib/http/streaming";
import { allowRestrictedPaths } from "~/middleware/auth";
import { validateCaptcha } from "~/middleware/captchaMiddleware";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { handleCancelChatRun } from "~/services/chat-runs/cancel";
import { handleReplayChatRunEvents } from "~/services/chat-runs/replay";
import {
  handleGetChatRun,
  handleGetChatRunCommand,
  handleGetChatRunSnapshot,
} from "~/services/chat-runs/status";
import { handleArchiveAllChatCompletions } from "~/services/completions/archiveAllChatCompletions";
import { handleCancelChatCompletion } from "~/services/completions/cancelChatCompletion";
import { handleChatCompletionFeedbackSubmission } from "~/services/completions/chatCompletionFeedbackSubmission";
import { handleCheckChatCompletion } from "~/services/completions/checkChatCompletion";
import { handleCompactChatCompletion } from "~/services/completions/compactChatCompletion";
import { getConversationBranches } from "~/services/completions/conversationBranches";
import {
  handleGetConversationGoal,
  handleSetConversationGoal,
  handleUpdateConversationGoal,
} from "~/services/completions/conversationGoal";
import { handleCountTokens } from "~/services/completions/countTokens";
import { handleCreateApplyEditCompletions } from "~/services/completions/createApplyEditCompletions";
import { handleCreateChatCompletions } from "~/services/completions/createChatCompletions";
import { handleCreateFimCompletions } from "~/services/completions/createFimCompletions";
import { handleCreateNextEditCompletions } from "~/services/completions/createNextEditCompletions";
import { handleDeleteAllChatCompletions } from "~/services/completions/deleteAllChatCompletions";
import { handleDeleteChatCompletion } from "~/services/completions/deleteChatCompletion";
import { handleGenerateChatCompletionTitle } from "~/services/completions/generateChatCompletionTitle";
import { handleGetChatCompletion } from "~/services/completions/getChatCompletion";
import {
  handleGetChatMessageById,
  handleGetChatMessages,
} from "~/services/completions/getChatMessages";
import { handleGetSharedConversation } from "~/services/completions/getSharedConversation";
import { handleListChatCompletions } from "~/services/completions/listChatCompletions";
import { handleShareConversation } from "~/services/completions/shareConversation";
import { handleUnshareConversation } from "~/services/completions/unshareConversation";
import { handleUpdateChatCompletion } from "~/services/completions/updateChatCompletion";
import type { ChatRole, IEnv, IUser, Message } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { readNumericField, readRecordObjectField } from "~/utils/recordFields";

import { registerConversationOrganisationRoutes } from "./chat-organisation";

const app = new Hono();

const routeLogger = createRouteLogger("chat");
const chatMessageListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    after: z.string().optional(),
    before: z.string().optional(),
  })
  .refine(({ after, before }) => !(after && before), {
    message: "Use either after or before, not both",
  });

const sharedChatMessageListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  after: z.string().optional(),
});

const getChatCompletionQuerySchema = z
  .object({
    refresh_pending: z.enum(["true", "false"]).optional().default("false"),
    message_limit: z.coerce.number().int().min(1).max(100).optional().default(100),
    ...recoveryTelemetryQueryFields,
  })
  .superRefine(validateRecoveryTelemetryQuery);

const chatRunRecoveryQuerySchema = z
  .object(recoveryTelemetryQueryFields)
  .superRefine(validateRecoveryTelemetryQuery);
const chatCompletionsListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  page: z.coerce.number().int().min(1).optional().default(1),
  archived: conversationArchiveFilterSchema.optional(),
  include_archived: z.enum(["true", "false"]).optional().default("false"),
  q: z.string().trim().max(200).optional(),
  sort_by: conversationSortBySchema.optional().default("updated"),
  updated_after: z.iso.datetime().optional(),
});

function respondWithStreamOrJson(_context: Context, result: unknown, stream?: boolean): Response {
  if (stream) {
    return sseResponse(result as ReadableStream);
  }

  return ResponseFactory.success(_context, result);
}

app.use("/*", async (context: Context, next: Next) => {
  routeLogger.info(`Processing chat route: ${context.req.path}`);

  await allowRestrictedPaths(context, next);
});

addRoute(app, "post", "/completions", {
  tags: ["chat"],
  summary: "Create chat completion",
  description:
    "Creates a model response for the given chat conversation. Please note that parameter support can differ depending on the model used to generate the response.",
  bodySchema: createChatCompletionsJsonSchema,
  responses: {
    200: {
      description: "Chat completion response with model generation",
      schema: z.union([chatCompletionResponseSchema, chatRunCommandReceiptResponseSchema]),
    },
    400: {
      description: "Bad request or validation error",
      schema: errorResponseSchema,
    },
    401: { description: "Authentication error", schema: errorResponseSchema },
  },
  middleware: [validateCaptcha],
  handler: async ({ raw }) =>
    (async (context: Context) => {
      const body = context.req.valid("json" as never) as ChatCompletionRequestBody;

      const userContext = context.get("user");
      const anonymousUserContext = context.get("anonymousUser");
      const serviceContext = getServiceContext(context);
      const cfProperties = readRecordObjectField(context.req.raw, "cf");

      const user = {
        longitude: readNumericField(cfProperties, "longitude"),
        latitude: readNumericField(cfProperties, "latitude"),
        ...userContext,
      };

      if (user?.id) {
        try {
          await serviceContext.getUserSettings();
        } catch (error) {
          routeLogger.warn("Failed to preload user settings", {
            requestId: serviceContext.requestId,
            error,
          });
        }
      }

      const response = await handleCreateChatCompletions({
        env: context.env as IEnv,
        request: body,
        user,
        anonymousUser: anonymousUserContext,
        context: serviceContext,
        executionCtx: requireCloudflareExecutionContext(context.executionCtx),
        signal: context.req.raw.signal,
      });

      if (response instanceof Response) {
        return response;
      }

      return ResponseFactory.success(context, response);
    })(raw),
});

addRoute(app, "post", "/fim/completions", {
  tags: ["chat", "code"],
  summary: "Create fill-in-the-middle completion",
  description:
    "Generates code completions by filling the gap between a prefix and suffix using supported FIM models.",
  bodySchema: fillInMiddleRequestSchema,
  responses: {
    200: {
      description: "Fill-in-the-middle completion response",
      schema: fillInMiddleResponseSchema,
    },
    400: {
      description: "Bad request or validation error",
      schema: errorResponseSchema,
    },
    401: { description: "Authentication error", schema: errorResponseSchema },
  },
  middleware: [validateCaptcha],
  handler: async ({ raw }) =>
    (async (context: Context) => {
      const body = context.req.valid("json" as never) as z.infer<typeof fillInMiddleRequestSchema>;

      const result = await handleCreateFimCompletions({
        env: context.env as IEnv,
        user: context.get("user") as IUser | undefined,
        ...body,
      });

      return respondWithStreamOrJson(context, result, body.stream);
    })(raw),
});

addRoute(app, "post", "/edit/completions", {
  tags: ["chat", "code"],
  summary: "Create next edit completion",
  description: "Produces the next edit suggestion for a file using Mercury's code edit model.",
  bodySchema: nextEditRequestSchema,
  responses: {
    200: {
      description: "Edit suggestion response",
      schema: editCompletionResponseSchema,
    },
    400: {
      description: "Bad request or validation error",
      schema: errorResponseSchema,
    },
  },
  middleware: [validateCaptcha],
  handler: async ({ raw }) =>
    (async (context: Context) => {
      const body = context.req.valid("json" as never) as z.infer<typeof nextEditRequestSchema>;

      const result = await handleCreateNextEditCompletions({
        env: context.env as IEnv,
        user: context.get("user") as IUser | undefined,
        ...body,
      });

      return respondWithStreamOrJson(context, result, body.stream);
    })(raw),
});

addRoute(app, "post", "/apply/completions", {
  tags: ["chat", "code"],
  summary: "Apply edit completion",
  description: "Applies an edit snippet to existing code using Mercury's apply edit capability.",
  bodySchema: applyEditRequestSchema,
  responses: {
    200: {
      description: "Edit application response",
      schema: editCompletionResponseSchema,
    },
    400: {
      description: "Bad request or validation error",
      schema: errorResponseSchema,
    },
  },
  middleware: [validateCaptcha],
  handler: async ({ raw }) =>
    (async (context: Context) => {
      const body = context.req.valid("json" as never) as z.infer<typeof applyEditRequestSchema>;

      const result = await handleCreateApplyEditCompletions({
        env: context.env as IEnv,
        user: context.get("user") as IUser | undefined,
        ...body,
      });

      return respondWithStreamOrJson(context, result, body.stream);
    })(raw),
});

addRoute(app, "post", "/completions/count-tokens", {
  tags: ["chat"],
  summary: "Count tokens for a chat request",
  description:
    "Count the number of tokens that would be used for a chat completion request. Useful for estimating costs and staying within token limits.",
  bodySchema: countTokensJsonSchema,
  responses: {
    200: {
      description: "Token count result",
      schema: countTokensResponseSchema,
    },
    400: {
      description: "Bad request or validation error",
      schema: errorResponseSchema,
    },
    401: { description: "Authentication error", schema: errorResponseSchema },
  },
  middleware: [validateCaptcha],
  handler: async ({ raw }) =>
    (async (context: Context) => {
      const body = context.req.valid("json" as never) as {
        model: string;
        provider?: string;
        messages: Message[];
        system_prompt?: string;
      };

      const serviceContext = getServiceContext(context);

      const response = await handleCountTokens(serviceContext, body);

      return ResponseFactory.success(context, response);
    })(raw),
});

addRoute(app, "delete", "/completions", {
  tags: ["chat"],
  summary: "Delete all chat completions",
  description: "Delete all chat completions for the current user",
  responses: {
    200: { description: "Deletion status" },
  },
  handler: async ({ raw }) =>
    (async (context: Context) => {
      const serviceContext = getServiceContext(context);

      const response = await handleDeleteAllChatCompletions(serviceContext);

      return ResponseFactory.success(context, response);
    })(raw),
});

addRoute(app, "patch", "/completions", {
  tags: ["chat"],
  summary: "Archive or restore many chat completions",
  description:
    "Set the archived state of every stored personal chat completion matching the supplied filters. Only conversations that are not already in the requested state are changed.",
  bodySchema: bulkArchiveChatCompletionsJsonSchema,
  responses: {
    200: {
      description: "Number of chat completions whose archived state changed",
      schema: bulkArchiveChatCompletionsResponseSchema,
    },
    400: {
      description: "Bad request or validation error",
      schema: errorResponseSchema,
    },
  },
  handler: async ({ raw }) =>
    (async (context: Context) => {
      const { archived, q, updated_after } = context.req.valid("json" as never) as z.infer<
        typeof bulkArchiveChatCompletionsJsonSchema
      >;

      const serviceContext = getServiceContext(context);

      const response = await handleArchiveAllChatCompletions(serviceContext, {
        archived,
        query: q,
        updatedAfter: updated_after,
      });

      return ResponseFactory.success(context, response);
    })(raw),
});

addRoute(app, "get", "/completions/:completion_id", {
  tags: ["chat"],
  summary: "Get chat completion",
  description:
    "Get a stored chat completion. Only chat completions that have been created with the store parameter set to true will be returned.",
  paramSchema: getChatCompletionParamsSchema,
  querySchema: getChatCompletionQuerySchema,
  responses: {
    200: {
      description: "Chat completion details",
      schema: getChatCompletionResponseSchema,
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
      const query = context.req.valid("query" as never) as z.infer<
        typeof getChatCompletionQuerySchema
      >;

      const serviceContext = getServiceContext(context);
      const refreshPending = query.refresh_pending === "true";

      const data = await handleGetChatCompletion(serviceContext, completion_id, {
        refreshPending,
        messageLimit: query.message_limit,
      });

      if (
        query.recovery_platform &&
        query.recovery_attempt !== undefined &&
        query.recovery_elapsed_ms !== undefined &&
        query.recovery_known_assistant_count !== undefined &&
        query.recovery_final_attempt
      ) {
        recordTurnRecoveryAttempt(
          {
            env: serviceContext.env,
            executionCtx: requireCloudflareExecutionContext(context.executionCtx),
            traceId: completion_id,
          },
          {
            platform: query.recovery_platform,
            attempt: query.recovery_attempt,
            elapsedMs: query.recovery_elapsed_ms,
            knownAssistantCount: query.recovery_known_assistant_count,
            finalAttempt: query.recovery_final_attempt === "true",
          },
          countAssistantMessages(data.messages),
        );
      }

      return ResponseFactory.success(context, data);
    })(raw),
});

addRoute(app, "get", "/runs/:run_id", {
  auth: true,
  tags: ["chat"],
  summary: "Get chat run status",
  description: "Returns the authoritative lifecycle state for an authorised stored chat run.",
  paramSchema: chatRunParamsSchema,
  querySchema: chatRunRecoveryQuerySchema,
  responses: {
    200: {
      description: "Chat run status and stored messages",
      schema: chatRunRecoveryResponseSchema,
    },
    404: { description: "Run not found", schema: errorResponseSchema },
  },
  handler: ({ raw }) =>
    (async (context: Context) => {
      const { run_id } = context.req.valid("param" as never) as z.infer<typeof chatRunParamsSchema>;
      const query = context.req.valid("query" as never) as z.infer<
        typeof chatRunRecoveryQuerySchema
      >;
      const serviceContext = getServiceContext(context);
      const data = await handleGetChatRun(serviceContext, run_id);

      if (
        query.recovery_platform &&
        query.recovery_attempt !== undefined &&
        query.recovery_elapsed_ms !== undefined &&
        query.recovery_known_assistant_count !== undefined &&
        query.recovery_final_attempt
      ) {
        recordTurnRecoveryAttempt(
          {
            env: serviceContext.env,
            executionCtx: requireCloudflareExecutionContext(context.executionCtx),
            traceId: run_id,
          },
          {
            platform: query.recovery_platform,
            attempt: query.recovery_attempt,
            elapsedMs: query.recovery_elapsed_ms,
            knownAssistantCount: query.recovery_known_assistant_count,
            finalAttempt: query.recovery_final_attempt === "true",
          },
          countAssistantMessages(data.messages),
        );
      }

      return ResponseFactory.success(context, data);
    })(raw),
});

addRoute(app, "get", "/run-commands/:command_id", {
  auth: true,
  tags: ["chat"],
  summary: "Resolve an accepted chat command",
  paramSchema: chatRunCommandParamsSchema,
  responses: {
    200: { description: "Accepted chat command", schema: chatRunCommandReceiptResponseSchema },
    404: { description: "Command not found", schema: errorResponseSchema },
  },
  handler: ({ serviceContext, params }) =>
    handleGetChatRunCommand(serviceContext, params.command_id),
});

addRoute(app, "get", "/runs/:run_id/snapshot", {
  auth: true,
  tags: ["chat"],
  summary: "Get an authoritative chat run snapshot",
  paramSchema: chatRunParamsSchema,
  responses: {
    200: {
      description: "Chat run snapshot at a replay cursor",
      schema: chatRunSnapshotResponseSchema,
    },
    404: { description: "Run not found", schema: errorResponseSchema },
  },
  handler: ({ serviceContext, params }) => handleGetChatRunSnapshot(serviceContext, params.run_id),
});

addRoute(app, "get", "/runs/:run_id/events", {
  auth: true,
  tags: ["chat"],
  summary: "Replay ordered chat run events",
  paramSchema: chatRunParamsSchema,
  querySchema: chatRunReplayQuerySchema,
  responses: {
    200: {
      description: "Ordered run events or an explicit snapshot reset",
      schema: chatRunReplayResponseSchema,
    },
    404: { description: "Run not found", schema: errorResponseSchema },
  },
  handler: ({ serviceContext, params, query }) =>
    handleReplayChatRunEvents(serviceContext, params.run_id, query),
});

addRoute(app, "post", "/runs/:run_id/cancel", {
  auth: true,
  tags: ["chat"],
  summary: "Cancel an exact chat run attempt",
  paramSchema: chatRunParamsSchema,
  bodySchema: cancelChatRunRequestSchema,
  responses: {
    200: {
      description: "Cancellation command accepted",
      schema: chatRunCommandReceiptResponseSchema,
    },
    404: { description: "Run not found", schema: errorResponseSchema },
    409: { description: "Run attempt changed", schema: errorResponseSchema },
  },
  handler: ({ serviceContext, params, body }) =>
    handleCancelChatRun(serviceContext, params.run_id, body),
});

addRoute(app, "get", "/completions/:completion_id/branches", {
  auth: true,
  tags: ["chat"],
  summary: "List the authorised conversation branch family",
  paramSchema: getChatCompletionParamsSchema,
  responses: {
    200: { description: "Conversation branches", schema: conversationBranchesResponseSchema },
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

addRoute(app, "post", "/completions/:completion_id/cancel", {
  tags: ["chat"],
  summary: "Cancel an in-flight chat completion",
  description:
    "Asks the running turn for this conversation to stop. The partial response is kept, and cancelling an already-finished turn is a no-op.",
  paramSchema: getChatCompletionParamsSchema,
  responses: {
    200: {
      description: "Cancellation requested",
      schema: cancelChatCompletionResponseSchema,
    },
    404: { description: "Completion not found", schema: errorResponseSchema },
  },
  handler: async ({ raw }) =>
    (async (context: Context) => {
      const { completion_id } = context.req.valid("param" as never) as {
        completion_id: string;
      };

      const serviceContext = getServiceContext(context);
      const response = await handleCancelChatCompletion(serviceContext, completion_id, {
        executionCtx: requireCloudflareExecutionContext(context.executionCtx),
        platform: context.req.header("X-Platform"),
      });

      return ResponseFactory.success(context, response);
    })(raw),
});

addRoute(app, "post", "/completions/:completion_id/compact", {
  tags: ["chat"],
  summary: "Compact chat completion history",
  description:
    "Summarises older stored chat history into a snapshot without creating a new chat turn.",
  paramSchema: getChatCompletionParamsSchema,
  responses: {
    200: {
      description: "Compaction result and refreshed conversation",
      schema: compactChatCompletionResponseSchema,
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

      const serviceContext = getServiceContext(context);
      const response = await handleCompactChatCompletion(serviceContext, completion_id);

      return ResponseFactory.success(context, response);
    })(raw),
});

addRoute(app, "get", "/completions/:completion_id/goal", {
  tags: ["chat"],
  summary: "Get the conversation goal",
  description: "Returns the active goal for a conversation, if one is set.",
  paramSchema: getChatCompletionParamsSchema,
  responses: {
    200: { description: "The active goal, or null", schema: goalResponseSchema },
    404: { description: "Completion not found", schema: errorResponseSchema },
  },
  handler: async ({ raw }) =>
    (async (context: Context) => {
      const { completion_id } = context.req.valid("param" as never) as {
        completion_id: string;
      };

      const response = await handleGetConversationGoal(getServiceContext(context), completion_id);

      return ResponseFactory.success(context, response);
    })(raw),
});

addRoute(app, "post", "/completions/:completion_id/goal", {
  tags: ["chat"],
  summary: "Set the conversation goal",
  description:
    "Sets a persistent objective for the conversation. Replaces the objective in place when one is already active.",
  paramSchema: getChatCompletionParamsSchema,
  bodySchema: setGoalRequestSchema,
  responses: {
    200: { description: "The stored goal", schema: goalResponseSchema },
    400: { description: "Bad request or validation error", schema: errorResponseSchema },
  },
  handler: async ({ raw }) =>
    (async (context: Context) => {
      const { completion_id } = context.req.valid("param" as never) as {
        completion_id: string;
      };
      const body = context.req.valid("json" as never) as z.infer<typeof setGoalRequestSchema>;

      const response = await handleSetConversationGoal(
        getServiceContext(context),
        completion_id,
        body.objective,
        { projectId: body.project_id },
      );

      return ResponseFactory.success(context, response);
    })(raw),
});

addRoute(app, "patch", "/completions/:completion_id/goal", {
  tags: ["chat"],
  summary: "Update the conversation goal lifecycle",
  description: "Pauses, resumes, or clears the active goal.",
  paramSchema: getChatCompletionParamsSchema,
  bodySchema: updateGoalRequestSchema,
  responses: {
    200: { description: "The updated goal", schema: goalResponseSchema },
    404: { description: "No goal on this conversation", schema: errorResponseSchema },
  },
  handler: async ({ raw }) =>
    (async (context: Context) => {
      const { completion_id } = context.req.valid("param" as never) as {
        completion_id: string;
      };
      const body = context.req.valid("json" as never) as z.infer<typeof updateGoalRequestSchema>;

      const response = await handleUpdateConversationGoal(
        getServiceContext(context),
        completion_id,
        body,
      );

      return ResponseFactory.success(context, response);
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

addRoute(app, "get", "/completions", {
  tags: ["chat"],
  summary: "List chat completions",
  description:
    "List stored chat completions. Only chat completions that have been stored with the store parameter set to true will be returned.",
  querySchema: chatCompletionsListQuerySchema,
  responses: {
    200: {
      description: "List of chat completions with pagination metadata",
      schema: z.object({
        data: z.array(
          z.object({
            id: z.string(),
            type: conversationTypeSchema,
            title: z.string().nullable(),
            created_at: z.string(),
            updated_at: z.string(),
            model: z.string(),
            is_archived: z.boolean(),
            user_id: z.string(),
            share_id: z.string().nullable(),
          }),
        ),
        total: z.number(),
        page: z.number(),
        limit: z.number(),
        pages: z.number(),
      }),
    },
    400: {
      description: "Bad request or validation error",
      schema: errorResponseSchema,
    },
  },
  middleware: [validateCaptcha],
  handler: async ({ raw }) =>
    (async (context: Context) => {
      const { archived, include_archived, limit, page, q, sort_by, updated_after } =
        context.req.valid("query" as never) as z.infer<typeof chatCompletionsListQuerySchema>;
      const archiveFilter = archived ?? (include_archived === "true" ? "all" : "active");

      const serviceContext = getServiceContext(context);

      const response = await handleListChatCompletions(serviceContext, {
        archiveFilter,
        limit,
        page,
        query: q,
        sortBy: sort_by,
        updatedAfter: updated_after,
      });

      return ResponseFactory.success(context, response);
    })(raw),
});

addRoute(app, "post", "/completions/:completion_id/generate-title", {
  tags: ["chat"],
  summary: "Generate a title for a chat",
  description:
    "Generate a title for a chat completion and then update the metadata with the title.",
  bodySchema: generateChatCompletionTitleJsonSchema,
  paramSchema: generateChatCompletionTitleParamsSchema,
  responses: {
    200: {
      description: "Generated title with update status",
      schema: z.object({
        success: z.boolean(),
        title: z.string(),
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
      const { messages, store } = context.req.valid("json" as never) as {
        messages: Message[];
        store: boolean;
      };

      const serviceContext = getServiceContext(context);

      const response = await handleGenerateChatCompletionTitle(
        serviceContext,
        completion_id,
        messages,
        store,
      );

      return ResponseFactory.success(context, response);
    })(raw),
});

addRoute(app, "put", "/completions/:completion_id", {
  tags: ["chat"],
  summary: "Update a chat completion",
  description:
    "Modify a stored chat completion. Only chat completions that have been created with the store parameter set to true can be modified.",
  bodySchema: updateChatCompletionJsonSchema,
  paramSchema: updateChatCompletionParamsSchema,
  responses: {
    200: {
      description: "Updated completion details",
      schema: getChatCompletionResponseSchema
        .extend({
          messages: z.array(messageSchema).optional(),
        })
        .passthrough(),
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
      const updates = context.req.valid("json" as never);

      const serviceContext = getServiceContext(context);

      const response = await handleUpdateChatCompletion(serviceContext, completion_id, updates);

      return ResponseFactory.success(context, response);
    })(raw),
});

addRoute(app, "delete", "/completions/:completion_id", {
  tags: ["chat"],
  summary: "Delete chat completion",
  description:
    "Delete a stored chat completion. Only chat completions that have been created with the store parameter set to true can be deleted.",
  paramSchema: deleteChatCompletionParamsSchema,
  responses: {
    200: {
      description: "Deletion status",
      schema: z.object({
        success: z.boolean(),
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

      const serviceContext = getServiceContext(context);

      const response = await handleDeleteChatCompletion(serviceContext, completion_id);

      return ResponseFactory.success(context, response);
    })(raw),
});

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

      const serviceContext = getServiceContext(context);

      const response = await handleChatCompletionFeedbackSubmission(serviceContext, {
        request: body,
        completion_id,
        authorise: async () => {
          const user = serviceContext.requireUser();

          serviceContext.ensureDatabase();
          const conversationManager = ConversationManager.getInstance({
            database: serviceContext.database,
            user,
          });
          const conversation = await conversationManager.getConversationDetails(completion_id);

          if (!conversation.messages.some((message) => message.log_id === body.log_id)) {
            throw new AssistantError("Feedback target not found", ErrorType.NOT_FOUND, 404);
          }
        },
      });

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

registerConversationOrganisationRoutes(app);

export default app;

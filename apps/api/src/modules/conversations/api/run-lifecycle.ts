import {
  cancelChatCompletionResponseSchema,
  compactChatCompletionResponseSchema,
  chatRunParamsSchema,
  chatRunCommandParamsSchema,
  chatRunCommandReceiptResponseSchema,
  chatRunRecoveryResponseSchema,
  chatRunReplayQuerySchema,
  chatRunReplayResponseSchema,
  chatRunSnapshotResponseSchema,
  cancelChatRunRequestSchema,
  getChatCompletionParamsSchema,
  errorResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import type { Context, Hono } from "hono";
import type z from "zod/v4";

import { requireCloudflareExecutionContext } from "~/infrastructure/cloudflare/execution-context";
import { getServiceContext } from "~/infrastructure/context/serviceContext";
import { ResponseFactory } from "~/infrastructure/http/ResponseFactory";
import { addRoute } from "~/infrastructure/http/routeBuilder";
import { handleCancelChatRun } from "~/modules/chat-runs/application/cancel";
import { handleReplayChatRunEvents } from "~/modules/chat-runs/application/replay";
import {
  handleGetChatRun,
  handleGetChatRunCommand,
  handleGetChatRunSnapshot,
} from "~/modules/chat-runs/application/status";
import { handleCancelChatCompletion } from "~/modules/completions/application/cancelChatCompletion";
import { handleCompactChatCompletion } from "~/modules/completions/application/compactChatCompletion";

export function registerConversationRunRoutes(app: Hono): void {
  addRoute(app, "get", "/runs/:run_id", {
    auth: true,
    tags: ["chat"],
    summary: "Get chat run status",
    description: "Returns the authoritative lifecycle state for an authorised stored chat run.",
    paramSchema: chatRunParamsSchema,
    responses: {
      200: {
        description: "Chat run status and stored messages",
        schema: chatRunRecoveryResponseSchema,
      },
      404: { description: "Run not found", schema: errorResponseSchema },
    },
    handler: ({ raw }) =>
      (async (context: Context) => {
        const { run_id } = context.req.valid("param" as never) as z.infer<
          typeof chatRunParamsSchema
        >;
        const serviceContext = getServiceContext(context);
        const data = await handleGetChatRun(serviceContext, run_id);

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
    handler: ({ serviceContext, params }) =>
      handleGetChatRunSnapshot(serviceContext, params.run_id),
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
    handler: ({ serviceContext, params, body, raw }) =>
      handleCancelChatRun(serviceContext, params.run_id, body, raw.req.header("X-Platform")),
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
}

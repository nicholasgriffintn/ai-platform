import {
  delegationListResponseSchema,
  getChatCompletionParamsSchema,
  goalResponseSchema,
  setGoalRequestSchema,
  updateGoalRequestSchema,
  errorResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import type { Context, Hono } from "hono";
import type z from "zod/v4";

import { getServiceContext } from "~/infrastructure/context/serviceContext";
import { ResponseFactory } from "~/infrastructure/http/ResponseFactory";
import { addRoute } from "~/infrastructure/http/routeBuilder";
import {
  handleGetConversationGoal,
  handleSetConversationGoal,
  handleUpdateConversationGoal,
} from "~/modules/completions/application/conversationGoal";
import { requireConversationAccess } from "~/modules/conversations/application/access";
import { cancelDelegationsForConversation } from "~/modules/delegations/application/cancel-tree";
import { listDelegationsWithReferences } from "~/modules/delegations/application/list";

export function registerConversationGoalAndDelegationRoutes(app: Hono): void {
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

  addRoute(app, "get", "/completions/:completion_id/delegations", {
    tags: ["chat"],
    summary: "List conversation delegations",
    description:
      "Returns delegations spawned by this conversation after checking conversation access.",
    paramSchema: getChatCompletionParamsSchema,
    responses: {
      200: { description: "Conversation delegations", schema: delegationListResponseSchema },
      404: { description: "Completion not found", schema: errorResponseSchema },
    },
    handler: async ({ raw }) =>
      (async (context: Context) => {
        const { completion_id } = context.req.valid("param" as never) as {
          completion_id: string;
        };
        const serviceContext = getServiceContext(context);

        await requireConversationAccess(serviceContext, completion_id);
        const result = await listDelegationsWithReferences(serviceContext, completion_id);

        return ResponseFactory.success(context, result);
      })(raw),
  });

  addRoute(app, "post", "/completions/:completion_id/delegations/cancel", {
    tags: ["chat"],
    summary: "Cancel conversation delegations",
    description: "Cancels all live delegations spawned by this conversation after checking access.",
    paramSchema: getChatCompletionParamsSchema,
    responses: {
      200: { description: "Delegations cancelled" },
      404: { description: "Completion not found", schema: errorResponseSchema },
    },
    handler: async ({ raw }) =>
      (async (context: Context) => {
        const { completion_id } = context.req.valid("param" as never) as {
          completion_id: string;
        };
        const serviceContext = getServiceContext(context);

        await requireConversationAccess(serviceContext, completion_id);
        const cancelled = await cancelDelegationsForConversation(
          serviceContext,
          completion_id,
          serviceContext.requireUser().id,
        );

        if (!cancelled) {
          throw new AssistantError(
            "Only the person who started a live delegation can cancel it",
            ErrorType.FORBIDDEN,
            403,
          );
        }

        return ResponseFactory.success(context, { cancelled: true });
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
}

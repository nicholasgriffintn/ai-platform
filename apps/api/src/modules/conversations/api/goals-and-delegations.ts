import {
  conversationParamsSchema,
  delegationListResponseSchema,
  errorResponseSchema,
  goalResponseSchema,
  setGoalRequestSchema,
  updateGoalRequestSchema,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ResourceBuilder } from "~/infrastructure/http/resource";
import { cancelDelegationsForConversation } from "~/modules/delegations/application/cancel-tree";
import { listDelegationsWithReferences } from "~/modules/delegations/application/list";

import { requireConversationAccess } from "../application/access";
import {
  handleGetConversationGoal,
  handleSetConversationGoal,
  handleUpdateConversationGoal,
} from "../application/conversationGoal";

export function defineConversationGoalAndDelegations(conversations: ResourceBuilder): void {
  const goal = conversations.singleton("goal");
  const delegations = conversations.sub("delegations", "delegation_id");

  goal.read({
    auth: "user-or-anonymous",
    summary: "Get the conversation goal",
    paramSchema: conversationParamsSchema,
    responses: {
      200: { description: "The active goal, or null", schema: goalResponseSchema },
      404: { description: "Conversation not found", schema: errorResponseSchema },
    },
    handler: ({ serviceContext, params }) =>
      handleGetConversationGoal(serviceContext, params.conversation_id),
  });

  goal.create({
    auth: "user-or-anonymous",
    summary: "Set the conversation goal",
    description: "Sets a persistent objective. Replaces the objective in place when one is active.",
    paramSchema: conversationParamsSchema,
    bodySchema: setGoalRequestSchema,
    responses: {
      200: { description: "The stored goal", schema: goalResponseSchema },
      400: { description: "Bad request or validation error", schema: errorResponseSchema },
    },
    handler: ({ serviceContext, params, body }) =>
      handleSetConversationGoal(serviceContext, params.conversation_id, body.objective, {
        projectId: body.project_id,
      }),
  });

  goal.update({
    auth: "user-or-anonymous",
    summary: "Update the conversation goal lifecycle",
    description: "Pauses, resumes, or clears the active goal.",
    paramSchema: conversationParamsSchema,
    bodySchema: updateGoalRequestSchema,
    responses: {
      200: { description: "The updated goal", schema: goalResponseSchema },
      404: { description: "No goal on this conversation", schema: errorResponseSchema },
    },
    handler: ({ serviceContext, params, body }) =>
      handleUpdateConversationGoal(serviceContext, params.conversation_id, body),
  });

  delegations.list({
    auth: true,
    summary: "List conversation delegations",
    paramSchema: conversationParamsSchema,
    responses: {
      200: { description: "Conversation delegations", schema: delegationListResponseSchema },
      404: { description: "Conversation not found", schema: errorResponseSchema },
    },
    handler: async ({ serviceContext, params }) => {
      await requireConversationAccess(serviceContext, params.conversation_id);

      return listDelegationsWithReferences(serviceContext, params.conversation_id);
    },
  });

  delegations.collectionAction("cancel", {
    auth: true,
    summary: "Cancel conversation delegations",
    paramSchema: conversationParamsSchema,
    responses: {
      200: { description: "Delegations cancelled" },
      404: { description: "Conversation not found", schema: errorResponseSchema },
    },
    handler: async ({ serviceContext, params }) => {
      await requireConversationAccess(serviceContext, params.conversation_id);
      const cancelled = await cancelDelegationsForConversation(
        serviceContext,
        params.conversation_id,
        serviceContext.requireUser().id,
      );

      if (!cancelled) {
        throw new AssistantError(
          "Only the person who started a live delegation can cancel it",
          ErrorType.FORBIDDEN,
          403,
        );
      }

      return { cancelled: true };
    },
  });
}

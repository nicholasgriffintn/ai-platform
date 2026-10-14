import {
  checkConversationRequestSchema,
  checkConversationResponseSchema,
  conversationFeedbackRequestSchema,
  conversationParamsSchema,
  errorResponseSchema,
  shareConversationResponseSchema,
  sharedConversationParamsSchema,
  sharedConversationQuerySchema,
  sharedConversationResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import type { ResourceBuilder } from "~/infrastructure/http/resource";
import { validateCaptcha } from "~/middleware/captchaMiddleware";

import { handleCheckChatCompletion } from "../application/checkChatCompletion";
import { submitConversationFeedback } from "../application/feedback-submission";
import { handleGetSharedConversation } from "../application/getSharedConversation";
import { presentItems } from "../application/present";
import { handleShareConversation } from "../application/shareConversation";
import { handleUnshareConversation } from "../application/unshareConversation";

export function defineConversationSharing(conversations: ResourceBuilder): void {
  conversations.action("check", {
    auth: "user-or-anonymous",
    tags: ["conversations", "guardrails"],
    summary: "Check a conversation against guardrails",
    paramSchema: conversationParamsSchema,
    bodySchema: checkConversationRequestSchema,
    responses: {
      200: {
        description: "Guardrail check results",
        schema: checkConversationResponseSchema,
      },
      404: { description: "Conversation not found", schema: errorResponseSchema },
    },
    handler: async ({ serviceContext, params, body }) => ({
      response: await handleCheckChatCompletion(serviceContext, params.conversation_id, body.role),
    }),
  });

  conversations.action("feedback", {
    summary: "Submit feedback about an item",
    auth: true,
    paramSchema: conversationParamsSchema,
    bodySchema: conversationFeedbackRequestSchema,
    responses: {
      200: {
        description: "Feedback submission status",
        schema: z.object({ response: z.object({ status: z.string(), message: z.string() }) }),
      },
      404: { description: "Conversation not found", schema: errorResponseSchema },
    },
    middleware: [validateCaptcha],
    handler: async ({ serviceContext, params, body }) => ({
      response: await submitConversationFeedback(serviceContext, params.conversation_id, {
        message_id: body.item_id,
        log_id: body.log_id,
        feedback: body.feedback,
        score: body.score,
      }),
    }),
  });

  const share = conversations.singleton("share");

  share.create({
    auth: "user-or-anonymous",
    summary: "Share a conversation publicly",
    paramSchema: conversationParamsSchema,
    responses: {
      200: { description: "Share link details", schema: shareConversationResponseSchema },
      404: { description: "Conversation not found", schema: errorResponseSchema },
    },
    middleware: [validateCaptcha],
    handler: ({ serviceContext, params }) =>
      handleShareConversation(serviceContext, params.conversation_id),
  });

  share.delete({
    auth: "user-or-anonymous",
    summary: "Unshare a conversation",
    paramSchema: conversationParamsSchema,
    responses: {
      200: { description: "Unshare result", schema: z.object({ success: z.boolean() }) },
      404: { description: "Conversation or share not found", schema: errorResponseSchema },
    },
    handler: ({ serviceContext, params }) =>
      handleUnshareConversation(serviceContext, params.conversation_id),
  });

  conversations.shared({
    auth: false,
    summary: "Read a shared conversation",
    description: "Returns the items of a publicly shared conversation by its share ID.",
    paramSchema: sharedConversationParamsSchema,
    querySchema: sharedConversationQuerySchema,
    responses: {
      200: { description: "Shared conversation items", schema: sharedConversationResponseSchema },
      404: { description: "Shared conversation not found", schema: errorResponseSchema },
    },
    handler: async ({ serviceContext, params, query, raw }) => {
      const result = await handleGetSharedConversation(
        serviceContext,
        params.token,
        query.limit,
        query.after,
      );

      raw.header("Cache-Control", "no-store");
      raw.header("Referrer-Policy", "no-referrer");
      raw.header("X-Robots-Tag", "noindex, nofollow");

      return {
        items: presentItems(result.messages),
        share_id: result.share_id,
        shared_through: result.shared_through,
      };
    },
  });
}

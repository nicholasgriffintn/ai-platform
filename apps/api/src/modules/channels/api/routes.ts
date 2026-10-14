import {
  channelBindingSchema,
  channelPairingChallengeSchema,
  createChannelBindingSchema,
  listChannelBindingsResponseSchema,
  listChannelSendersResponseSchema,
  revokeChannelSenderQuerySchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { defineResource } from "~/infrastructure/http/resource";
import {
  createChannelBinding,
  deleteChannelBinding,
  listChannelBindings,
} from "~/modules/channels/application/bindings";
import {
  issueChannelPairingChallenge,
  listChannelSenders,
  revokeChannelSender,
} from "~/modules/channels/application/senders";

const app = new Hono();
const bindingParamsSchema = z.object({ binding_id: z.string().min(1) });
const senderParamsSchema = bindingParamsSchema.extend({ sender_id: z.string().min(1) });

defineResource(
  app,
  { path: "/bindings", idParam: "binding_id", tags: ["channels"] },
  (bindings) => {
    bindings
      .list({
        auth: true,
        summary: "List the channels connected to Polychat",
        responses: { 200: { description: "Bindings", schema: listChannelBindingsResponseSchema } },
        handler: ({ serviceContext }) => listChannelBindings(serviceContext),
      })
      .create({
        auth: true,
        summary: "Connect a channel",
        description:
          "Bind a Slack channel or Telegram chat to a person or a project. Slack may bind to either; Telegram is personal only.",
        bodySchema: createChannelBindingSchema,
        responses: { 200: { description: "The binding", schema: channelBindingSchema } },
        handler: ({ serviceContext, body }) => createChannelBinding(serviceContext, body),
      })
      .delete({
        auth: true,
        summary: "Disconnect a channel",
        paramSchema: bindingParamsSchema,
        handler: async ({ serviceContext, params }) => {
          await deleteChannelBinding(serviceContext, params.binding_id);

          return { deleted: true };
        },
      });

    bindings.sub("pairing_challenges", "challenge_id").create({
      auth: true,
      summary: "Link your own channel identity",
      paramSchema: bindingParamsSchema,
      responses: {
        200: { description: "One-time linking command", schema: channelPairingChallengeSchema },
      },
      handler: ({ serviceContext, params }) =>
        issueChannelPairingChallenge(serviceContext, params.binding_id),
    });

    bindings
      .sub("senders", "sender_id")
      .list({
        auth: true,
        summary: "List verified channel senders",
        paramSchema: bindingParamsSchema,
        responses: { 200: { description: "Senders", schema: listChannelSendersResponseSchema } },
        handler: ({ serviceContext, params }) =>
          listChannelSenders(serviceContext, params.binding_id),
      })
      .delete({
        auth: true,
        summary: "Revoke a linked sender",
        paramSchema: senderParamsSchema,
        querySchema: revokeChannelSenderQuerySchema,
        handler: async ({ serviceContext, params, query }) => {
          await revokeChannelSender(
            serviceContext,
            params.binding_id,
            params.sender_id,
            query.expected_revision,
          );

          return { revoked: true };
        },
      });
  },
);

export default app;

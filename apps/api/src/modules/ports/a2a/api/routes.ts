import {
  a2aAgentCardSchema,
  errorResponseSchema,
  jsonRpcResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { requireCloudflareExecutionContext } from "~/infrastructure/cloudflare/execution-context";
import { defineResource } from "~/infrastructure/http/resource";

import { buildTeammateAgentCard, requireA2aTeammate } from "../application/agent-card";
import { handleA2aRequest } from "../application/server";

const app = new Hono();
const teammateParamsSchema = z.object({ teammate_id: z.string().min(1).max(200) });

defineResource(app, { path: "/teammates", idParam: "teammate_id", tags: ["a2a"] }, (teammates) => {
  teammates.singleton(".well-known/agent-card.json").read({
    auth: true,
    summary: "A teammate's A2A agent card",
    description:
      "Describes one of your teammates to agents that speak the Agent2Agent protocol. Authenticate with a Polychat API key; cards are only shown to the teammate's owner.",
    paramSchema: teammateParamsSchema,
    responses: {
      200: { description: "Agent card", schema: a2aAgentCardSchema },
      404: { description: "Teammate not found", schema: errorResponseSchema },
    },
    handler: async ({ serviceContext, params, raw }) =>
      buildTeammateAgentCard(
        await requireA2aTeammate(serviceContext, params.teammate_id),
        new URL(raw.req.url).origin,
      ),
  });

  teammates.action("rpc", {
    auth: true,
    summary: "Talk to a teammate over A2A",
    description:
      "JSON-RPC endpoint for Agent2Agent clients. Each task is a Polychat Response in the teammate's own conversation: message/send starts or follows one up, message/stream streams it, and tasks/get and tasks/cancel read and stop it. Runs use the key owner's authority and wait on them in Polychat for approvals.",
    paramSchema: teammateParamsSchema,
    bodySchema: z.record(z.string(), z.unknown()),
    responses: {
      200: { description: "JSON-RPC response, or an event stream", schema: jsonRpcResponseSchema },
      404: { description: "Teammate not found", schema: errorResponseSchema },
    },
    handler: async ({ serviceContext, params, body, raw }) => {
      await requireA2aTeammate(serviceContext, params.teammate_id);

      const response = await handleA2aRequest({
        context: serviceContext,
        teammateId: params.teammate_id,
        payload: body,
        executionCtx: requireCloudflareExecutionContext(raw.executionCtx),
        signal: raw.req.raw.signal,
      });

      return response ?? raw.body(null, 202);
    },
  });
});

export default app;

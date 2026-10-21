import { a2aAgentCardSchema } from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import { messageTeammateFromOutside } from "~/modules/teammates/application/external-message";

import { buildTeammateAgentCard, requireA2aTeammate } from "../application/agent-card";
import { handleA2aMessage } from "../application/server";

const app = new Hono();
const teammateParamsSchema = z.object({ teammate_id: z.string().min(1).max(200) });

addRoute(app, "get", "/teammates/:teammate_id/.well-known/agent-card.json", {
  tags: ["a2a"],
  summary: "A teammate's A2A agent card",
  description:
    "Describes one of your teammates to agents that speak the Agent2Agent protocol. Authenticate with a Polychat API key; cards are only shown to the teammate's owner.",
  auth: true,
  paramSchema: teammateParamsSchema,
  responses: { 200: { description: "Agent card", schema: a2aAgentCardSchema } },
  handler: async ({ serviceContext, params, raw }) =>
    buildTeammateAgentCard(
      await requireA2aTeammate(serviceContext, params.teammate_id),
      new URL(raw.req.url).origin,
    ),
});

addRoute(app, "post", "/teammates/:teammate_id", {
  tags: ["a2a"],
  summary: "Message a teammate over A2A",
  description:
    "JSON-RPC endpoint for Agent2Agent clients. message/send runs the teammate in its own Polychat conversation under the key owner's authority and returns its reply.",
  auth: true,
  paramSchema: teammateParamsSchema,
  bodySchema: z.record(z.string(), z.unknown()),
  responses: { 200: { description: "JSON-RPC response", schema: z.unknown() } },
  handler: async ({ serviceContext, params, body, raw }) => {
    await requireA2aTeammate(serviceContext, params.teammate_id);

    const response = await handleA2aMessage(body, (text) =>
      messageTeammateFromOutside(serviceContext, params.teammate_id, text),
    );

    return response ?? raw.body(null, 202);
  },
});

export default app;

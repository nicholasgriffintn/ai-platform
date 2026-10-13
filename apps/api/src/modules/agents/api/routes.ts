import {
  agentModelCompletionRequestSchema,
  errorResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import { listAgentModelIds } from "~/modules/agents/application/model-list";
import { createAgentModelCompletion } from "~/modules/agents/application/model-port";

const app = new Hono();

addRoute(app, "post", "/model/chat/completions", {
  tags: ["agents"],
  summary: "Agent model completion",
  description:
    "OpenAI-compatible chat completions for hosted agent harnesses. Calls run as the delegated user, use Polychat's model routing and are billed to that user.",
  bodySchema: agentModelCompletionRequestSchema,
  auth: true,
  responses: {
    200: { description: "Completion or completion stream" },
    401: { description: "Authentication required", schema: errorResponseSchema },
    403: { description: "Model not available to the user", schema: errorResponseSchema },
  },
  handler: async ({ serviceContext, user, body, raw }) =>
    createAgentModelCompletion({
      context: serviceContext,
      user,
      request: agentModelCompletionRequestSchema.parse(body),
      conversationId: raw.req.header("x-polychat-conversation-id")?.trim() || "agent-harness",
    }),
});

addRoute(app, "get", "/model/models", {
  tags: ["agents"],
  summary: "Agent models",
  description: "Lists the model ids a hosted agent harness may request for the delegated user.",
  auth: true,
  responses: {
    200: {
      description: "OpenAI-compatible model list",
      schema: z.object({
        object: z.literal("list"),
        data: z.array(z.object({ id: z.string(), object: z.literal("model") })),
      }),
    },
  },
  handler: async ({ serviceContext, user }) => ({
    object: "list" as const,
    data: (await listAgentModelIds(serviceContext, user)).map((id) => ({
      id,
      object: "model" as const,
    })),
  }),
});

export default app;

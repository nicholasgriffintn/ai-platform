import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import { createRouteLogger } from "~/middleware/loggerMiddleware";

import { handleMcpServerMessage } from "../application/server";
import { prefersEventStream, toEventStreamResponse } from "../application/transport";

const app = new Hono();
const routeLogger = createRouteLogger("mcp");

const jsonRpcBodySchema = z.union([
  z.record(z.string(), z.unknown()),
  z.array(z.record(z.string(), z.unknown())),
]);

addRoute(app, "post", "/", {
  tags: ["mcp"],
  summary: "Polychat as an MCP server",
  description:
    "Streamable HTTP endpoint for MCP clients such as Claude, ChatGPT and Codex. Authenticate with a Polychat API key. Tools: list_teammates, message_teammate, run_routine and read_attention, all under the key owner's own authority.",
  auth: true,
  bodySchema: jsonRpcBodySchema,
  responses: { 200: { description: "JSON-RPC response", schema: z.unknown() } },
  handler: async ({ serviceContext, body, raw }) => {
    routeLogger.info("MCP server request", { batch: Array.isArray(body) });

    const messages = Array.isArray(body) ? body : [body];
    const responses = (
      await Promise.all(messages.map((message) => handleMcpServerMessage(serviceContext, message)))
    ).filter((response) => response !== null);

    if (responses.length === 0) {
      return raw.body(null, 202);
    }

    if (prefersEventStream(raw.req.header("accept") ?? null)) {
      return toEventStreamResponse(responses);
    }

    return Array.isArray(body) ? responses : responses[0];
  },
});

app.get("/", (context) =>
  context.json(
    {
      error:
        "This MCP server sends no server-initiated messages. POST JSON-RPC requests; responses come as JSON or, if you only accept text/event-stream, as an event stream.",
    },
    405,
    { Allow: "POST" },
  ),
);

export default app;

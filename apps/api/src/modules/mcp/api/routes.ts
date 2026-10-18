import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import { createRouteLogger } from "~/middleware/loggerMiddleware";

import { handleMcpServerMessage } from "../application/server";

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

    if (Array.isArray(body)) {
      const responses = (
        await Promise.all(body.map((message) => handleMcpServerMessage(serviceContext, message)))
      ).filter((response) => response !== null);

      return responses.length === 0 ? raw.body(null, 202) : responses;
    }

    const response = await handleMcpServerMessage(serviceContext, body);

    return response ?? raw.body(null, 202);
  },
});

app.get("/", (context) =>
  context.json(
    { error: "This MCP server does not stream server events; send JSON-RPC requests with POST." },
    405,
  ),
);

export default app;

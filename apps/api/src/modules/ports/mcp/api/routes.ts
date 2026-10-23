import {
  errorResponseSchema,
  jsonRpcPayloadSchema,
  jsonRpcResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { defineSingleton } from "~/infrastructure/http/resource";

import { handleMcpRequest } from "../application/server";

const app = new Hono();

defineSingleton(app, { tags: ["mcp"] }, (endpoint) => {
  endpoint
    .create({
      auth: true,
      summary: "Polychat as an MCP server",
      description:
        "Streamable HTTP endpoint for MCP clients such as Claude, ChatGPT and Codex. Authenticate with a Polychat API key. tools/list offers the tools you can run in Polychat plus one tool per teammate; tools/call runs them under your authority, and anything that needs approval waits for you in Polychat.",
      bodySchema: jsonRpcPayloadSchema,
      responses: {
        200: {
          description: "JSON-RPC response or batch, or an event stream",
          schema: z.union([jsonRpcResponseSchema, z.array(jsonRpcResponseSchema)]),
        },
        202: { description: "Notifications accepted" },
      },
      handler: async ({ serviceContext, body, raw }) =>
        (await handleMcpRequest({
          context: serviceContext,
          payload: body,
          accept: raw.req.header("accept") ?? null,
          appUrl: new URL(raw.req.url).origin,
        })) ?? raw.body(null, 202),
    })
    .read({
      auth: true,
      summary: "Open an MCP event stream",
      description:
        "Polychat sends no server-initiated MCP messages, so this answers 405 as Streamable HTTP allows.",
      responses: { 405: { description: "No server stream", schema: errorResponseSchema } },
      handler: async ({ raw }) =>
        raw.json(
          {
            error: "This MCP server sends no server-initiated messages; POST JSON-RPC requests",
            type: "METHOD_NOT_ALLOWED",
          },
          405,
          { Allow: "POST" },
        ),
    });
});

export default app;

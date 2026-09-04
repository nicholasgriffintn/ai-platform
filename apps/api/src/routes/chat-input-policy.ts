import {
  chatInputPolicyStateSchema,
  updateChatInputPolicySchema,
  previewChatInputPolicySchema,
  chatInputPolicyPreviewSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { previewInputRewrite } from "~/lib/chat/policy/input-rewriting";
import { addRoute } from "~/lib/http/routeBuilder";
import { getChatInputPolicy, updateChatInputPolicy } from "~/services/chat-input-policy";

export function chatInputPolicyRoutes(projectScoped = false) {
  const app = new Hono();
  const paramSchema = z.object({
    projectId: projectScoped ? z.string().min(1) : z.string().optional(),
  });

  addRoute(app, "get", "/", {
    auth: true,
    tags: ["chat"],
    summary: "Read chat input policy and revision history",
    paramSchema,
    responses: { 200: { description: "Chat input policy", schema: chatInputPolicyStateSchema } },
    handler: ({ serviceContext, params }) =>
      getChatInputPolicy(serviceContext, projectScoped ? params.projectId : undefined),
  });
  addRoute(app, "put", "/", {
    auth: true,
    tags: ["chat"],
    summary: "Save or restore chat input policy",
    paramSchema,
    bodySchema: updateChatInputPolicySchema,
    responses: {
      200: { description: "Saved chat input policy", schema: chatInputPolicyStateSchema },
    },
    handler: ({ serviceContext, params, body }) =>
      updateChatInputPolicy(serviceContext, body, projectScoped ? params.projectId : undefined),
  });
  addRoute(app, "post", "/preview", {
    auth: true,
    tags: ["chat"],
    summary: "Preview a tool-result rewrite without saving or calling a provider",
    paramSchema,
    bodySchema: previewChatInputPolicySchema,
    responses: { 200: { description: "Rewrite preview", schema: chatInputPolicyPreviewSchema } },
    handler: async ({ serviceContext, params, body }) => {
      await getChatInputPolicy(serviceContext, projectScoped ? params.projectId : undefined);

      return previewInputRewrite(body.policy, body.content);
    },
  });

  return app;
}

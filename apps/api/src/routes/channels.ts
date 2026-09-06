import {
  apiResponseSchema,
  channelBindingSchema,
  createChannelBindingSchema,
  listChannelBindingsResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/lib/http/routeBuilder";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import {
  createChannelBinding,
  deleteChannelBinding,
  listChannelBindings,
} from "~/services/channels/bindings";

const app = new Hono();
const routeLogger = createRouteLogger("channels");

app.use("/*", async (ctx, next) => {
  routeLogger.info(`Processing channels route: ${ctx.req.method} ${ctx.req.path}`);

  return next();
});

addRoute(app, "get", "/bindings", {
  tags: ["channels"],
  summary: "List the channels connected to Polychat",
  auth: true,
  responses: { 200: { description: "Bindings", schema: listChannelBindingsResponseSchema } },
  handler: async ({ serviceContext }) => listChannelBindings(serviceContext),
});

addRoute(app, "post", "/bindings", {
  tags: ["channels"],
  summary: "Connect a channel",
  description:
    "Bind a Slack channel or Telegram chat to a person or a project. Slack may bind to either; Telegram is personal only.",
  auth: true,
  bodySchema: createChannelBindingSchema,
  responses: { 200: { description: "Binding", schema: channelBindingSchema } },
  handler: async ({ serviceContext, body }) => createChannelBinding(serviceContext, body),
});

addRoute(app, "delete", "/bindings/:bindingId", {
  tags: ["channels"],
  summary: "Disconnect a channel",
  auth: true,
  paramSchema: z.object({ bindingId: z.string().min(1) }),
  responses: { 200: { description: "Success", schema: apiResponseSchema } },
  handler: async ({ serviceContext, params }) => {
    await deleteChannelBinding(serviceContext, params.bindingId);

    return { success: true };
  },
});

export default app;

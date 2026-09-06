import {
  apiResponseSchema,
  listSavedMessagesResponseSchema,
  saveMessageSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/lib/http/routeBuilder";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { listSavedMessages, saveMessage, unsaveMessage } from "~/services/saved-messages";

const app = new Hono();
const routeLogger = createRouteLogger("saved-messages");

app.use("/*", async (ctx, next) => {
  routeLogger.info(`Processing saved messages route: ${ctx.req.method} ${ctx.req.path}`);

  return next();
});

addRoute(app, "get", "/", {
  tags: ["chat"],
  summary: "List saved messages",
  description: "The messages the caller has kept for later, newest first.",
  auth: true,
  querySchema: z.object({ limit: z.coerce.number().int().min(1).max(100).optional() }),
  responses: { 200: { description: "Saved messages", schema: listSavedMessagesResponseSchema } },
  handler: async ({ serviceContext, query }) => listSavedMessages(serviceContext, query.limit),
});

addRoute(app, "post", "/", {
  tags: ["chat"],
  summary: "Save a message for later",
  auth: true,
  bodySchema: saveMessageSchema,
  responses: { 200: { description: "Success", schema: apiResponseSchema } },
  handler: async ({ serviceContext, body }) => {
    await saveMessage(serviceContext, body);

    return { success: true };
  },
});

addRoute(app, "delete", "/:messageId", {
  tags: ["chat"],
  summary: "Stop keeping a message",
  auth: true,
  paramSchema: z.object({ messageId: z.string().min(1) }),
  responses: { 200: { description: "Success", schema: apiResponseSchema } },
  handler: async ({ serviceContext, params }) => {
    await unsaveMessage(serviceContext, params.messageId);

    return { success: true };
  },
});

export default app;

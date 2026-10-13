import {
  chatCompletionResponseBodySchema,
  chatCompletionsPortRequestSchema,
  errorResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import { type Context, Hono, type Next } from "hono";

import { requireCloudflareExecutionContext } from "~/infrastructure/cloudflare/execution-context";
import { addRoute } from "~/infrastructure/http/routeBuilder";
import { allowRestrictedPaths } from "~/middleware/auth";
import { validateCaptcha } from "~/middleware/captchaMiddleware";
import { createRouteLogger } from "~/middleware/loggerMiddleware";

import { createChatCompletionThroughPort } from "../application/port";

const app = new Hono();
const routeLogger = createRouteLogger("chat-completions");

app.use("/*", async (context: Context, next: Next) => {
  routeLogger.info(`Processing chat completions port route: ${context.req.path}`);

  await allowRestrictedPaths(context, next);
});

addRoute(app, "post", "/", {
  tags: ["chat"],
  summary: "Create chat completion",
  description:
    "OpenAI-compatible chat completions. An unmodified OpenAI client works as-is; Polychat adds conversation, agent, environment, model_tier, permission_mode and the Polychat tool union on the same body. A stateless request runs the model directly and bills the caller; a request that names a conversation, agent or environment runs as a Response and is returned in chat completion shape with the Response attached.",
  auth: "user-or-anonymous",
  bodySchema: chatCompletionsPortRequestSchema,
  responses: {
    200: {
      description: "Chat completion, or a chat.completion.chunk stream",
      schema: chatCompletionResponseBodySchema,
    },
    400: { description: "Bad request or validation error", schema: errorResponseSchema },
    401: { description: "Authentication error", schema: errorResponseSchema },
    403: { description: "Model not available to the caller", schema: errorResponseSchema },
  },
  middleware: [validateCaptcha],
  handler: ({ serviceContext, body, user, anonymousUser, raw }) =>
    createChatCompletionThroughPort({
      context: serviceContext,
      request: body,
      user,
      anonymousUser,
      executionCtx: requireCloudflareExecutionContext(raw.executionCtx),
      signal: raw.req.raw.signal,
      platform: raw.req.header("X-Platform"),
      conversationHint: raw.req.header("x-polychat-conversation-id")?.trim() || undefined,
    }),
});

export default app;

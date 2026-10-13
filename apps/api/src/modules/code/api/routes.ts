import {
  applyEditRequestSchema,
  editCompletionResponseSchema,
  errorResponseSchema,
  fillInMiddleRequestSchema,
  fillInMiddleResponseSchema,
  nextEditRequestSchema,
} from "@ngriffin_uk/polychat-schemas";
import { type Context, Hono, type Next } from "hono";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import { sseResponse } from "~/infrastructure/http/streaming";
import { allowRestrictedPaths } from "~/middleware/auth";
import { validateCaptcha } from "~/middleware/captchaMiddleware";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import type { IEnv, IUser } from "~/types";

import { handleCreateApplyEditCompletions } from "../application/createApplyEditCompletions";
import { handleCreateFimCompletions } from "../application/createFimCompletions";
import { handleCreateNextEditCompletions } from "../application/createNextEditCompletions";

const app = new Hono();
const routeLogger = createRouteLogger("code");

app.use("/*", async (context: Context, next: Next) => {
  routeLogger.info(`Processing code route: ${context.req.path}`);

  await allowRestrictedPaths(context, next);
});

function respondWithStreamOrJson(result: unknown, stream?: boolean): unknown {
  return stream ? sseResponse(result as ReadableStream) : result;
}

addRoute(app, "post", "/fim", {
  tags: ["code"],
  summary: "Create fill-in-the-middle completion",
  description:
    "Generates code completions by filling the gap between a prefix and suffix using supported FIM models.",
  bodySchema: fillInMiddleRequestSchema,
  responses: {
    200: {
      description: "Fill-in-the-middle completion response",
      schema: fillInMiddleResponseSchema,
    },
    400: { description: "Bad request or validation error", schema: errorResponseSchema },
    401: { description: "Authentication error", schema: errorResponseSchema },
  },
  middleware: [validateCaptcha],
  handler: async ({ raw, body }) =>
    respondWithStreamOrJson(
      await handleCreateFimCompletions({
        env: raw.env as IEnv,
        user: raw.get("user") as IUser | undefined,
        ...body,
      }),
      body.stream,
    ),
});

addRoute(app, "post", "/next-edit", {
  tags: ["code"],
  summary: "Create next edit completion",
  description: "Produces the next edit suggestion for a file using Mercury's code edit model.",
  bodySchema: nextEditRequestSchema,
  responses: {
    200: { description: "Edit suggestion response", schema: editCompletionResponseSchema },
    400: { description: "Bad request or validation error", schema: errorResponseSchema },
  },
  middleware: [validateCaptcha],
  handler: async ({ raw, body }) =>
    respondWithStreamOrJson(
      await handleCreateNextEditCompletions({
        env: raw.env as IEnv,
        user: raw.get("user") as IUser | undefined,
        ...body,
      }),
      body.stream,
    ),
});

addRoute(app, "post", "/apply", {
  tags: ["code"],
  summary: "Apply edit completion",
  description: "Applies an edit snippet to existing code using Mercury's apply edit capability.",
  bodySchema: applyEditRequestSchema,
  responses: {
    200: { description: "Edit application response", schema: editCompletionResponseSchema },
    400: { description: "Bad request or validation error", schema: errorResponseSchema },
  },
  middleware: [validateCaptcha],
  handler: async ({ raw, body }) =>
    respondWithStreamOrJson(
      await handleCreateApplyEditCompletions({
        env: raw.env as IEnv,
        user: raw.get("user") as IUser | undefined,
        ...body,
      }),
      body.stream,
    ),
});

export default app;

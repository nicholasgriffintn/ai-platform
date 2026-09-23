import {
  decisionRequestSchema,
  decisionResponseSchema,
  errorResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import { decide } from "~/modules/decisions/application/decide";

const app = new Hono();

addRoute(app, "post", "/", {
  tags: ["decisions"],
  summary: "Make a decision",
  description:
    "Evaluates a state against one or more typed questions with a System One decision model and returns calibrated answers. Ask every question that might matter in one call: questions are independent and evaluated in parallel.",
  auth: true,
  bodySchema: decisionRequestSchema,
  responses: {
    200: { description: "Typed answers with probabilities", schema: decisionResponseSchema },
    400: { description: "Bad request or validation error", schema: errorResponseSchema },
  },
  handler: ({ body, serviceContext, user }) =>
    decide({ env: serviceContext.env, user, request: body }),
});

export default app;

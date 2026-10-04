import {
  decisionFeedbackRequestSchema,
  decisionFeedbackResponseSchema,
  decisionRequestSchema,
  decisionResponseSchema,
  errorResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import { decide } from "~/modules/decisions/application/decide";
import { recordDecisionFeedback } from "~/modules/decisions/application/feedback";

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

addRoute(app, "post", "/feedback", {
  tags: ["decisions"],
  summary: "Correct a decision",
  description:
    "Records that a policy recommended one outcome and a person chose another. Recent corrections for the same policy are shown to the model on later evaluations of that policy for the same account.",
  auth: true,
  bodySchema: decisionFeedbackRequestSchema,
  responses: {
    200: { description: "Correction recorded", schema: decisionFeedbackResponseSchema },
    400: { description: "Bad request or validation error", schema: errorResponseSchema },
  },
  handler: ({ body, serviceContext }) => recordDecisionFeedback(serviceContext, body),
});

export default app;

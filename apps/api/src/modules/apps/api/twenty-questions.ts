import {
  errorResponseSchema,
  twentyQuestionsAnswerSchema,
  twentyQuestionsAskRequestSchema,
  twentyQuestionsGameSchema,
  twentyQuestionsRevealRequestSchema,
  twentyQuestionsRevealSchema,
  twentyQuestionsStartRequestSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import {
  askTwentyQuestions,
  revealTwentyQuestions,
  startTwentyQuestions,
} from "~/modules/experiences/application/twenty-questions/game";
import {
  projectScopeQuerySchema,
  requireOptionalProjectCapabilityAccess,
} from "~/modules/workspaces/application/access";

const app = new Hono();

const CAPABILITY_ID = "featured-twenty-questions";

addRoute(app, "post", "/games", {
  tags: ["apps"],
  summary: "Start a game of Twenty Questions",
  description:
    "Picks a secret from the category and returns it sealed inside an opaque game token.",
  auth: true,
  bodySchema: twentyQuestionsStartRequestSchema,
  querySchema: projectScopeQuerySchema,
  responses: {
    200: { description: "A new game", schema: twentyQuestionsGameSchema },
    400: { description: "Bad request or validation error", schema: errorResponseSchema },
  },
  handler: async ({ body, query, serviceContext }) => {
    await requireOptionalProjectCapabilityAccess(
      serviceContext,
      query.projectId,
      "app",
      CAPABILITY_ID,
    );

    return startTwentyQuestions(serviceContext.env, body.category);
  },
});

addRoute(app, "post", "/ask", {
  tags: ["apps"],
  summary: "Ask a yes or no question",
  description:
    "Judges a question or guess against the sealed secret and returns a calibrated yes probability with a warmth reading.",
  auth: true,
  bodySchema: twentyQuestionsAskRequestSchema,
  querySchema: projectScopeQuerySchema,
  responses: {
    200: { description: "The answer", schema: twentyQuestionsAnswerSchema },
    400: { description: "Bad request or validation error", schema: errorResponseSchema },
  },
  handler: async ({ body, query, serviceContext, user }) => {
    await requireOptionalProjectCapabilityAccess(
      serviceContext,
      query.projectId,
      "app",
      CAPABILITY_ID,
    );

    return askTwentyQuestions(serviceContext.env, user, body.token, body.question);
  },
});

addRoute(app, "post", "/reveal", {
  tags: ["apps"],
  summary: "Reveal the secret",
  auth: true,
  bodySchema: twentyQuestionsRevealRequestSchema,
  querySchema: projectScopeQuerySchema,
  responses: {
    200: { description: "The secret", schema: twentyQuestionsRevealSchema },
    400: { description: "Bad request or validation error", schema: errorResponseSchema },
  },
  handler: async ({ body, query, serviceContext }) => {
    await requireOptionalProjectCapabilityAccess(
      serviceContext,
      query.projectId,
      "app",
      CAPABILITY_ID,
    );

    return revealTwentyQuestions(serviceContext.env, body.token);
  },
});

export default app;

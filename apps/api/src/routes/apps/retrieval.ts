import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi";

import { createRouteLogger } from "~/middleware/loggerMiddleware";
import {
  analyseHackerNewsStories,
  retrieveHackerNewsTopStories,
} from "~/services/apps/retrieval/hackernews";
import type { IEnv, IUser } from "~/types";
import { apiResponseSchema, errorResponseSchema } from "../../schemas/shared";
import z from "zod/v4";

const app = new Hono();

const routeLogger = createRouteLogger("apps/retrieval");

const hackerNewsQuerySchema = z.object({
  count: z
    .string()
    .optional()
    .transform((s) => {
      const n = Number(s || "10");
      if (isNaN(n) || n <= 0 || n > 100) {
        throw new Error("Count must be between 1 and 100");
      }
      return n;
    }),
  character: z
    .string()
    .optional()
    .transform((s) => s || "normal"),
});

app.use("/*", (c, next) => {
  routeLogger.info(`Processing apps route: ${c.req.path}`);
  return next();
});

app.get(
  "/hackernews/top-stories",
  describeRoute({
    tags: ["apps"],
    summary: "Get top stories from HackerNews",
    responses: {
      200: {
        description: "Success response with top stories",
        content: {
          "application/json": {
            schema: resolver(apiResponseSchema),
          },
        },
      },
      400: {
        description: "Bad request or validation error",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  zValidator("query", hackerNewsQuerySchema),
  async (context: Context) => {
    const { count, character } = context.req.valid("query" as never) as {
      count: number;
      character: string;
    };

    const stories = await retrieveHackerNewsTopStories({
      count,
      env: context.env as IEnv,
      user: context.get("user") as IUser,
    });

    const analysis = await analyseHackerNewsStories({
      character,
      stories,
      env: context.env as IEnv,
      user: context.get("user") as IUser,
    });

    return context.json({
      status: "success",
      message: "Stories retrieved successfully",
      data: {
        analysis: {
          content: analysis.content || analysis.response,
          log_id: analysis.log_id,
          citations: analysis.citations,
          usage: analysis.usage,
          model: analysis.model,
        },
        stories,
      },
    });
  },
);

export default app;

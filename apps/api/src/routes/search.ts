import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";

import { requireAuth } from "../middleware/auth";
import type { IEnv, SearchOptions } from "../types";

import { createRouteLogger } from "../middleware/loggerMiddleware";
import { handleWebSearch } from "../services/search/web";
import { searchWebSchema } from "./schemas/search";

const app = new Hono();

const routeLogger = createRouteLogger("SEARCH");

/**
 * Global middleware to add route-specific logging
 */
app.use("/*", (c, next) => {
  routeLogger.info(`Processing search route: ${c.req.path}`);
  return next();
});

/**
 * Global middleware to check authentication
 */
app.use("/*", requireAuth);

// Define common response schemas
const errorResponseSchema = z.object({
  error: z.string(),
  type: z.string(),
});

const searchResultSchema = z.object({
  title: z.string(),
  url: z.string(),
  snippet: z.string(),
  position: z.number().optional(),
});

const webSearchResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    results: z.array(searchResultSchema),
    query: z.string(),
  }),
});

app.post(
  "/web",
  describeRoute({
    tags: ["search"],
    title: "Web search",
    description: "Searches the web for the input query.",
    responses: {
      200: {
        description: "Search results from web providers",
        content: {
          "application/json": {
            schema: resolver(webSearchResponseSchema),
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
      401: {
        description: "Authentication required",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
      500: {
        description: "Server error or search provider error",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  zValidator("json", searchWebSchema),
  async (context: Context) => {
    const body = context.req.valid("json" as never) as {
      query: string;
      provider?: "serper" | "tavily";
      options?: SearchOptions;
    };
    const user = context.get("user");

    const response = await handleWebSearch({
      env: context.env as IEnv,
      query: body.query,
      user,
      provider: body.provider,
      options: body.options,
    });

    return context.json(response);
  },
);

export default app;

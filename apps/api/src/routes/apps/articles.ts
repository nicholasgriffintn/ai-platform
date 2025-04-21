import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";

import { createRouteLogger } from "~/middleware/loggerMiddleware";
import {
  type Params as AnalyseArticleParams,
  analyseArticle,
} from "~/services/apps/articles/analyse";
import {
  type Params as GenerateArticlesReportParams,
  generateArticlesReport,
} from "~/services/apps/articles/generate-report";
import {
  type Params as SummariseArticleParams,
  summariseArticle,
} from "~/services/apps/articles/summarise";
import type { IEnv } from "~/types";
import { generateId } from "~/utils/id";
import {
  articleAnalyzeSchema,
  articleSummariseSchema,
  generateArticlesReportSchema,
} from "../schemas/apps";

const app = new Hono();

const routeLogger = createRouteLogger("APPS_ARTICLES");

/**
 * Global middleware to add route-specific logging
 */
app.use("/*", (c, next) => {
  routeLogger.info(`Processing apps route: ${c.req.path}`);
  return next();
});

app.post(
  "/articles/analyse",
  describeRoute({
    tags: ["apps", "articles"],
    description: "Analyse an article",
    responses: {
      200: {
        description: "Response",
        content: {
          "application/json": {
            schema: resolver(z.object({})),
          },
        },
      },
    },
  }),
  zValidator("json", articleAnalyzeSchema),
  async (context: Context) => {
    const body = context.req.valid("json" as never) as AnalyseArticleParams;

    const completion_id = generateId();

    const newUrl = new URL(context.req.url);
    const app_url = `${newUrl.protocol}//${newUrl.hostname}`;

    const response = await analyseArticle({
      completion_id,
      env: context.env as IEnv,
      args: body,
      app_url,
    });

    return context.json({
      response,
    });
  },
);

app.post(
  "/articles/summarise",
  describeRoute({
    tags: ["apps", "articles"],
    description: "Summarise an article",
    responses: {
      200: {
        description: "Response",
        content: {
          "application/json": {
            schema: resolver(z.object({})),
          },
        },
      },
    },
  }),
  zValidator("json", articleSummariseSchema),
  async (context: Context) => {
    const body = context.req.valid("json" as never) as SummariseArticleParams;

    const completion_id = generateId();

    const newUrl = new URL(context.req.url);
    const app_url = `${newUrl.protocol}//${newUrl.hostname}`;

    const response = await summariseArticle({
      completion_id,
      env: context.env as IEnv,
      args: body,
      app_url,
    });

    return context.json({
      response,
    });
  },
);

app.post(
  "/articles/generate-report",
  describeRoute({
    tags: ["apps", "articles"],
    description: "Generate a report about a set of articles",
    responses: {
      200: {
        description: "Response",
        content: {
          "application/json": {
            schema: resolver(z.object({})),
          },
        },
      },
    },
  }),
  zValidator("json", generateArticlesReportSchema),
  async (context: Context) => {
    const body = context.req.valid(
      "json" as never,
    ) as GenerateArticlesReportParams;

    const completion_id = generateId();

    const newUrl = new URL(context.req.url);
    const app_url = `${newUrl.protocol}//${newUrl.hostname}`;

    const response = await generateArticlesReport({
      completion_id,
      env: context.env as IEnv,
      args: body,
      app_url,
    });

    return context.json({
      response,
    });
  },
);

export default app;

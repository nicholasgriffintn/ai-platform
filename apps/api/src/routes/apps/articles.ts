import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";

import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { AppDataRepository } from "~/repositories";
import { analyseArticle } from "~/services/apps/articles/analyse";
import { generateArticlesReport } from "~/services/apps/articles/generate-report";
import { getArticleDetails } from "~/services/apps/articles/get-details";
import { getSourceArticles } from "~/services/apps/articles/get-source-articles";
import { listArticles } from "~/services/apps/articles/list";
import { summariseArticle } from "~/services/apps/articles/summarise";
import { extractContent } from "~/services/apps/retrieval/content-extract";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import {
  articleAnalyzeSchema,
  articleSummariseSchema,
  contentExtractSchema,
  generateArticlesReportSchema,
} from "../schemas/apps";
import {
  articleDetailResponseSchema,
  listArticlesResponseSchema,
  sourceArticlesResponseSchema,
} from "../schemas/apps";
import { errorResponseSchema } from "../schemas/shared";

const app = new Hono();

const routeLogger = createRouteLogger("APPS_ARTICLES");

app.use("/*", (c, next) => {
  routeLogger.info(`Processing apps route: ${c.req.path}`);
  return next();
});

app.get(
  "/",
  describeRoute({
    tags: ["apps", "articles"],
    description: "List user's article reports",
    responses: {
      200: {
        description: "List of reports",
        content: {
          "application/json": {
            schema: resolver(listArticlesResponseSchema),
          },
        },
      },
      401: {
        description: "Unauthorized",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  async (context: Context) => {
    const user = context.get("user") as IUser | undefined;

    if (!user?.id) {
      return context.json(
        {
          response: {
            status: "error",
            message: "User not authenticated",
          },
        },
        401,
      );
    }

    if (user.plan_id !== "pro") {
      return context.json(
        {
          response: {
            status: "error",
            message: "User is not on pro plan",
          },
        },
        401,
      );
    }

    try {
      const response = await listArticles({
        env: context.env as IEnv,
        userId: user?.id,
      });

      return context.json({ articles: response.sessions });
    } catch (error) {
      routeLogger.error("Error listing articles:", { error });

      if (error instanceof AssistantError) {
        throw error;
      }

      throw new AssistantError(
        "Failed to list articles",
        ErrorType.UNKNOWN_ERROR,
        undefined,
        error,
      );
    }
  },
);

app.get(
  "/sources",
  describeRoute({
    tags: ["apps", "articles"],
    description: "Fetch multiple source articles by their IDs",
    parameters: [
      {
        name: "ids[]",
        in: "query",
        required: true,
        schema: { type: "array", items: { type: "string" } },
        description: "Array of article IDs to fetch",
      },
    ],
    responses: {
      200: {
        description: "Source articles data",
        content: {
          "application/json": {
            schema: resolver(sourceArticlesResponseSchema),
          },
        },
      },
      400: {
        description: "Bad Request - Invalid IDs",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
      401: {
        description: "Unauthorized",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
      403: {
        description: "Forbidden",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  async (context: Context) => {
    const user = context.get("user") as IUser | undefined;

    if (!user?.id) {
      return context.json(
        {
          response: {
            status: "error",
            message: "User not authenticated",
          },
        },
        401,
      );
    }

    if (user.plan_id !== "pro") {
      return context.json(
        {
          response: {
            status: "error",
            message: "User is not on pro plan",
          },
        },
        401,
      );
    }

    const url = new URL(context.req.url);
    const ids = url.searchParams.getAll("ids[]");

    if (!ids.length) {
      return context.json(
        { status: "error", message: "No article IDs provided" },
        400,
      );
    }

    const validIds = ids.filter(
      (id) => typeof id === "string" && id.trim().length > 0,
    );

    try {
      const response = await getSourceArticles({
        env: context.env as IEnv,
        ids: validIds,
        userId: user?.id,
      });

      return context.json({ status: "success", articles: response.articles });
    } catch (error) {
      routeLogger.error("Error fetching source articles:", { error, ids });

      if (error instanceof AssistantError) {
        throw error;
      }

      throw new AssistantError(
        "Failed to fetch source articles",
        ErrorType.UNKNOWN_ERROR,
        undefined,
        error,
      );
    }
  },
);

app.get(
  "/:id",
  describeRoute({
    tags: ["apps", "articles"],
    description: "Get details of a specific article report",
    responses: {
      200: {
        description: "Article report details",
        content: {
          "application/json": {
            schema: resolver(articleDetailResponseSchema),
          },
        },
      },
      401: {
        description: "Unauthorized",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
      403: {
        description: "Forbidden",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
      404: {
        description: "Article data not found",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  async (context: Context) => {
    const id = context.req.param("id");
    const user = context.get("user") as IUser | undefined;

    if (!user?.id) {
      return context.json(
        {
          response: {
            status: "error",
            message: "User not authenticated",
          },
        },
        401,
      );
    }

    if (user.plan_id !== "pro") {
      return context.json(
        {
          response: {
            status: "error",
            message: "User is not on pro plan",
          },
        },
        401,
      );
    }

    try {
      const response = await getArticleDetails({
        env: context.env as IEnv,
        id: id ?? "",
        userId: user?.id,
      });

      return context.json({ article: response.article });
    } catch (error) {
      routeLogger.error("Error getting article details:", { error, id });

      if (error instanceof AssistantError) {
        throw error;
      }

      throw new AssistantError(
        "Failed to get article details",
        ErrorType.UNKNOWN_ERROR,
        undefined,
        error,
      );
    }
  },
);

app.post(
  "/analyse",
  describeRoute({
    tags: ["apps", "articles"],
    description: "Analyse an article and save it for a session",
    responses: {
      200: {
        description: "Analysis saved",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                status: z.string(),
                appDataId: z.string(),
                itemId: z.string(),
                analysis: z.any(),
              }),
            ),
          },
        },
      },
      400: {
        description: "Bad Request",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
      401: {
        description: "Unauthorized",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  zValidator("json", articleAnalyzeSchema),
  async (context: Context) => {
    const body = context.req.valid("json" as never) as z.infer<
      typeof articleAnalyzeSchema
    >;
    const user = context.get("user") as IUser | undefined;

    if (!user?.id) {
      return context.json(
        {
          response: {
            status: "error",
            message: "User not authenticated",
          },
        },
        401,
      );
    }

    if (user.plan_id !== "pro") {
      return context.json(
        {
          response: {
            status: "error",
            message: "User is not on pro plan",
          },
        },
        401,
      );
    }

    try {
      const completion_id = generateId();
      const newUrl = new URL(context.req.url);
      const app_url = `${newUrl.protocol}//${newUrl.hostname}`;

      const response = await analyseArticle({
        completion_id,
        env: context.env as IEnv,
        args: { article: body.article, itemId: body.itemId },
        app_url,
        user,
      });

      return context.json(response);
    } catch (error) {
      routeLogger.error("Error analysing article:", {
        error,
        itemId: body.itemId,
      });

      if (error instanceof AssistantError) {
        throw error;
      }

      throw new AssistantError(
        "Failed to analyse article",
        ErrorType.UNKNOWN_ERROR,
        undefined,
        error,
      );
    }
  },
);

app.post(
  "/summarise",
  describeRoute({
    tags: ["apps", "articles"],
    description: "Summarise an article and save it for a session",
    responses: {
      200: {
        description: "Summary saved",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                status: z.string(),
                appDataId: z.string(),
                itemId: z.string(),
                summary: z.any(),
              }),
            ),
          },
        },
      },
      400: {
        description: "Bad Request",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
      401: {
        description: "Unauthorized",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  zValidator("json", articleSummariseSchema),
  async (context: Context) => {
    const body = context.req.valid("json" as never) as z.infer<
      typeof articleSummariseSchema
    >;
    const user = context.get("user") as IUser | undefined;

    if (!user?.id) {
      return context.json(
        {
          response: {
            status: "error",
            message: "User not authenticated",
          },
        },
        401,
      );
    }

    if (user.plan_id !== "pro") {
      return context.json(
        {
          response: {
            status: "error",
            message: "User is not on pro plan",
          },
        },
        401,
      );
    }

    try {
      const completion_id = generateId();
      const newUrl = new URL(context.req.url);
      const app_url = `${newUrl.protocol}//${newUrl.hostname}`;

      const response = await summariseArticle({
        completion_id,
        env: context.env as IEnv,
        args: { article: body.article, itemId: body.itemId },
        app_url,
        user,
      });

      return context.json(response);
    } catch (error) {
      routeLogger.error("Error summarising article:", {
        error,
        itemId: body.itemId,
      });

      if (error instanceof AssistantError) {
        throw error;
      }

      throw new AssistantError(
        "Failed to summarise article",
        ErrorType.UNKNOWN_ERROR,
        undefined,
        error,
      );
    }
  },
);

app.post(
  "/generate-report",
  describeRoute({
    tags: ["apps", "articles"],
    description:
      "Generates a comparison report from saved articles for a specific session (itemId)",
    responses: {
      200: {
        description: "Report generated and saved",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                status: z.string(),
                appDataId: z.string(),
                itemId: z.string(),
              }),
            ),
          },
        },
      },
      401: {
        description: "Unauthorized",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
      404: {
        description: "No analysis data found to generate report",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
      500: {
        description: "Failed to generate or save report",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  zValidator("json", generateArticlesReportSchema),
  async (context: Context) => {
    const body = context.req.valid("json" as never) as z.infer<
      typeof generateArticlesReportSchema
    >;
    const user = context.get("user") as IUser | undefined;

    if (!user?.id) {
      return context.json(
        {
          response: {
            status: "error",
            message: "User not authenticated",
          },
        },
        401,
      );
    }

    if (user.plan_id !== "pro") {
      return context.json(
        {
          response: {
            status: "error",
            message: "User is not on pro plan",
          },
        },
        401,
      );
    }

    try {
      const completion_id = generateId();
      const newUrl = new URL(context.req.url);
      const app_url = `${newUrl.protocol}//${newUrl.hostname}`;

      const response = await generateArticlesReport({
        completion_id,
        env: context.env as IEnv,
        args: { itemId: body.itemId },
        app_url,
        user,
      });

      return context.json(response);
    } catch (error) {
      routeLogger.error("Error generating report:", {
        error,
        itemId: body.itemId,
      });

      if (error instanceof AssistantError) {
        throw error;
      }

      throw new AssistantError(
        "Failed to generate report",
        ErrorType.UNKNOWN_ERROR,
        undefined,
        error,
      );
    }
  },
);

app.post(
  "/prepare-rerun/:itemId",
  describeRoute({
    tags: ["apps", "articles"],
    description:
      "Prepare a session for rerun by cleaning up existing analyses and summaries",
    parameters: [
      {
        name: "itemId",
        in: "path",
        required: true,
        schema: { type: "string" },
        description: "The session ID to prepare for rerun",
      },
    ],
    responses: {
      200: {
        description: "Session prepared for rerun",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                status: z.string(),
                message: z.string(),
              }),
            ),
          },
        },
      },
      400: {
        description: "Bad Request",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
      401: {
        description: "Unauthorized",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  async (context: Context) => {
    const itemId = context.req.param("itemId");
    const user = context.get("user") as IUser | undefined;

    if (!user?.id) {
      return context.json(
        {
          status: "error",
          message: "User not authenticated",
        },
        401,
      );
    }

    if (user.plan_id !== "pro") {
      return context.json(
        {
          status: "error",
          message: "User is not on pro plan",
        },
        401,
      );
    }

    if (!itemId) {
      return context.json(
        {
          status: "error",
          message: "Item ID is required",
        },
        400,
      );
    }

    try {
      // Delete existing analyses and summaries for this session
      const appDataRepo = new AppDataRepository(context.env as IEnv);

      // Clean up existing analyses and summaries
      await appDataRepo.deleteAppDataByUserAppAndItem(
        user.id,
        "articles",
        itemId,
        "analysis",
      );

      await appDataRepo.deleteAppDataByUserAppAndItem(
        user.id,
        "articles",
        itemId,
        "summary",
      );

      return context.json({
        status: "success",
        message: "Session prepared for rerun",
      });
    } catch (error) {
      routeLogger.error("Error preparing session for rerun:", {
        error,
        itemId,
      });

      if (error instanceof AssistantError) {
        throw error;
      }

      throw new AssistantError(
        "Failed to prepare session for rerun",
        ErrorType.UNKNOWN_ERROR,
        undefined,
        error,
      );
    }
  },
);

app.post(
  "/extract-content",
  describeRoute({
    tags: ["apps", "articles"],
    description: "Extract content from URLs for article analysis",
    responses: {
      200: {
        description: "Content successfully extracted",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                status: z.string(),
                data: z.object({
                  content: z.array(z.string()),
                  failedUrls: z.array(
                    z.object({
                      url: z.string(),
                      error: z.string(),
                    }),
                  ),
                }),
              }),
            ),
          },
        },
      },
      400: {
        description: "Bad Request",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
      401: {
        description: "Unauthorized",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  zValidator("json", contentExtractSchema),
  async (context: Context) => {
    const body = context.req.valid("json" as never) as z.infer<
      typeof contentExtractSchema
    >;
    const user = context.get("user") as IUser | undefined;

    if (!user?.id) {
      return context.json(
        {
          response: {
            status: "error",
            message: "User not authenticated",
          },
        },
        401,
      );
    }

    if (user.plan_id !== "pro") {
      return context.json(
        {
          response: {
            status: "error",
            message: "User is not on pro plan",
          },
        },
        401,
      );
    }

    try {
      const extractResult = await extractContent(
        {
          urls: body.urls,
          extract_depth: body.extract_depth || "basic",
          include_images: body.include_images || false,
        },
        {
          env: context.env as IEnv,
          user,
        },
      );

      if (extractResult.status === "error") {
        return context.json(
          {
            status: "error",
            message: extractResult.error || "Failed to extract content",
          },
          400,
        );
      }

      const content =
        extractResult.data?.extracted.results.map(
          (result) => result.raw_content,
        ) || [];

      const failedUrls = extractResult.data?.extracted.failed_results || [];

      return context.json({
        status: "success",
        data: {
          content,
          failedUrls,
        },
      });
    } catch (error) {
      routeLogger.error("Error extracting content from URL:", {
        error,
        urls: body.urls,
      });

      if (error instanceof AssistantError) {
        throw error;
      }

      throw new AssistantError(
        "Failed to extract content from URL",
        ErrorType.UNKNOWN_ERROR,
        undefined,
        error,
      );
    }
  },
);

export default app;

import type { deepResearchSchema } from "@ngriffin_uk/polychat-schemas";
import {
  apiResponseSchema,
  errorResponseSchema,
  captureScreenshotSchema,
  contentExtractSchema,
  ocrSchema,
  ocrResultSchema,
  weatherQuerySchema,
  weatherResponseSchema,
  deepWebSearchSchema,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { type Context, Hono } from "hono";
import z from "zod/v4";

import { getServiceContext } from "~/infrastructure/context/serviceContext";
import { ResponseFactory } from "~/infrastructure/http/ResponseFactory";
import { addRoute } from "~/infrastructure/http/routeBuilder";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { requirePlan } from "~/middleware/requirePlan";
import {
  type ContentExtractParams,
  extractContent,
} from "~/modules/tools/application/retrieval/content-extract";
import {
  analyseHackerNewsStories,
  retrieveHackerNewsTopStories,
} from "~/modules/tools/application/retrieval/hackernews";
import { performOcr } from "~/modules/tools/application/retrieval/ocr";
import {
  type CaptureScreenshotParams,
  captureScreenshot,
} from "~/modules/tools/application/retrieval/screenshot";
import { getWeatherForLocation } from "~/modules/tools/application/retrieval/weather";
import {
  type DeepWebSearchParams,
  performDeepWebSearch,
} from "~/modules/tools/application/retrieval/web-search";
import { projectScopeQuerySchema } from "~/modules/workspaces/application/access";
import type { IEnv, IUser } from "~/types";

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

type DeepResearchBody = z.infer<typeof deepResearchSchema>;
app.use("/*", (c, next) => {
  routeLogger.info(`Processing apps route: ${c.req.path}`);

  return next();
});

addRoute(app, "get", "/hackernews/top-stories", {
  tags: ["apps"],
  summary: "Get top stories from HackerNews",
  querySchema: hackerNewsQuerySchema,
  responses: {
    200: {
      description: "Success response with top stories",
      schema: apiResponseSchema,
    },
    400: {
      description: "Bad request or validation error",
      schema: errorResponseSchema,
    },
  },
  handler: async ({ raw }) =>
    (async (context: Context) => {
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

      return ResponseFactory.success(
        context,
        {
          analysis: analysis
            ? {
                content: analysis.text,
                log_id: analysis.logId,
                citations: analysis.citations,
                usage: analysis.usage,
                model: analysis.model,
              }
            : null,
          stories,
        },
        200,
      );
    })(raw),
});

addRoute(app, "post", "/content-extract", {
  tags: ["apps"],
  description: "Extract content from a set of URLs",
  bodySchema: contentExtractSchema,
  middleware: [requirePlan("pro")],
  handler: async ({ raw }) =>
    (async (context: Context) => {
      const body = context.req.valid("json" as never) as ContentExtractParams;
      const user = context.get("user");
      const response = await extractContent(body, {
        env: context.env as IEnv,
        user,
      });

      return ResponseFactory.success(context, { response });
    })(raw),
});

addRoute(app, "post", "/capture-screenshot", {
  tags: ["apps"],
  description: "Capture a screenshot of a webpage",
  bodySchema: captureScreenshotSchema,
  middleware: [requirePlan("pro")],
  handler: async ({ raw }) =>
    (async (context: Context) => {
      const body = context.req.valid("json" as never) as CaptureScreenshotParams;
      const serviceContext = getServiceContext(context);
      const response = await captureScreenshot(body, {
        env: context.env as IEnv,
        context: serviceContext,
        user: serviceContext.requireUser(),
      });

      return ResponseFactory.success(context, { response });
    })(raw),
});

addRoute(app, "post", "/ocr", {
  tags: ["apps"],
  summary: "Perform OCR on an image",
  description: "Extract text from a document or image using an OCR provider",
  bodySchema: ocrSchema,
  querySchema: projectScopeQuerySchema,
  auth: true,
  responses: {
    200: {
      description: "OCR result with extracted text",
      schema: ocrResultSchema,
    },
    400: {
      description: "Bad request or validation error",
      schema: errorResponseSchema,
    },
  },
  handler: ({ body, query, serviceContext, user }) =>
    performOcr({
      context: serviceContext,
      userId: user.id,
      projectId: query.projectId,
      request: body,
    }),
});

addRoute(app, "get", "/weather", {
  tags: ["apps"],
  description: "Get the weather for a location",
  querySchema: weatherQuerySchema,
  responses: {
    200: {
      description: "Weather information for the specified location",
      schema: weatherResponseSchema,
    },
    400: {
      description: "Bad request or invalid coordinates",
      schema: errorResponseSchema,
    },
  },
  handler: async ({ raw }) =>
    (async (context: Context) => {
      const query = context.req.valid("query" as never) as {
        longitude: string;
        latitude: string;
      };

      const longitude = query.longitude ? Number.parseFloat(query.longitude) : Number.NaN;
      const latitude = query.latitude ? Number.parseFloat(query.latitude) : Number.NaN;

      if (
        !Number.isFinite(longitude) ||
        !Number.isFinite(latitude) ||
        longitude < -180 ||
        longitude > 180 ||
        latitude < -90 ||
        latitude > 90
      ) {
        throw new AssistantError("Invalid longitude or latitude", ErrorType.PARAMS_ERROR);
      }

      const response = await getWeatherForLocation(context.env as IEnv, {
        longitude,
        latitude,
      });

      return ResponseFactory.success(context, { response });
    })(raw),
});

addRoute(app, "post", "/web-search", {
  tags: ["apps"],
  description: "Perform a deep web search",
  bodySchema: deepWebSearchSchema,
  responses: {
    200: { description: "Web search results", schema: apiResponseSchema },
    400: {
      description: "Bad request or validation error",
      schema: errorResponseSchema,
    },
  },
  handler: async ({ raw }) =>
    (async (context: Context) => {
      const body = context.req.valid("json" as never) as DeepWebSearchParams;
      const user = context.get("user");

      if (!user?.id) {
        return ResponseFactory.error(context, "User not authenticated", 401);
      }

      const response = await performDeepWebSearch(context.env as IEnv, user, body);

      return ResponseFactory.success(context, { response });
    })(raw),
});

export default app;

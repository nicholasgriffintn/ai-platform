import { type Context, Hono } from "hono";
import { describeRoute, resolver, validator as zValidator } from "hono-openapi";
import {
  apiResponseSchema,
  errorResponseSchema,
  captureScreenshotSchema,
  contentExtractSchema,
  ocrSchema,
  weatherQuerySchema,
  weatherResponseSchema,
  deepWebSearchSchema,
  tutorSchema,
} from "@assistant/schemas";
import z from "zod/v4";

import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { AssistantError, ErrorType } from "~/utils/errors";
import type { IEnv, IUser } from "~/types";
import { checkPlanRequirement } from "~/services/user/userOperations";
import {
  analyseHackerNewsStories,
  retrieveHackerNewsTopStories,
} from "~/services/apps/retrieval/hackernews";
import {
  type ContentExtractParams,
  extractContent,
} from "~/services/apps/retrieval/content-extract";
import {
  type CaptureScreenshotParams,
  captureScreenshot,
} from "~/services/apps/retrieval/screenshot";
import { type OcrParams, performOcr } from "~/services/apps/retrieval/ocr";
import { getWeatherForLocation } from "~/services/apps/retrieval/weather";
import {
  type DeepWebSearchParams,
  performDeepWebSearch,
} from "~/services/apps/retrieval/web-search";
import {
  type TutorRequestParams,
  completeTutorRequest,
} from "~/services/apps/tutor";

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

app.post(
  "/content-extract",
  describeRoute({
    tags: ["apps"],
    description: "Extract content from a set of URLs",
  }),
  zValidator("json", contentExtractSchema),
  async (context: Context) => {
    const body = context.req.valid("json" as never) as ContentExtractParams;
    const user = context.get("user");

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

    const planCheck = checkPlanRequirement(user, "pro");
    if (!planCheck.isValid) {
      return context.json(
        {
          response: {
            status: "error",
            message: planCheck.message,
          },
        },
        401,
      );
    }

    const response = await extractContent(body, {
      env: context.env as IEnv,
      user,
    });

    return context.json({
      response,
    });
  },
);

app.post(
  "/capture-screenshot",
  describeRoute({
    tags: ["apps"],
    description: "Capture a screenshot of a webpage",
  }),
  zValidator("json", captureScreenshotSchema),
  async (context: Context) => {
    const user = context.get("user");

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

    const planCheck = checkPlanRequirement(user, "pro");
    if (!planCheck.isValid) {
      return context.json(
        {
          response: {
            status: "error",
            message: planCheck.message,
          },
        },
        401,
      );
    }

    const body = context.req.valid("json" as never) as CaptureScreenshotParams;

    const response = await captureScreenshot(body, {
      env: context.env as IEnv,
    });

    return context.json({
      response,
    });
  },
);

app.post(
  "/ocr",
  describeRoute({
    tags: ["apps"],
    summary: "Perform OCR on an image",
    description: "Extract text from an image using Mistral's OCR API",
    responses: {
      200: {
        description: "OCR result with extracted text",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                status: z.string(),
                data: z
                  .object({
                    text: z.string().optional(),
                    pages: z
                      .array(
                        z.object({
                          page_num: z.number(),
                          text: z.string(),
                          elements: z.array(z.any()).optional(),
                        }),
                      )
                      .optional(),
                  })
                  .optional(),
                error: z.string().optional(),
              }),
            ),
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
  zValidator("json", ocrSchema),
  async (context: Context) => {
    const body = context.req.valid("json" as never) as OcrParams;
    const user = context.get("user");

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

    const planCheck = checkPlanRequirement(user, "pro");
    if (!planCheck.isValid) {
      return context.json(
        {
          response: {
            status: "error",
            message: planCheck.message,
          },
        },
        401,
      );
    }

    const result = await performOcr(body, {
      env: context.env as IEnv,
      user,
    });

    return context.json(result);
  },
);

app.get(
  "/weather",
  describeRoute({
    tags: ["apps"],
    description: "Get the weather for a location",
    responses: {
      200: {
        description: "Weather information for the specified location",
        content: {
          "application/json": {
            schema: resolver(weatherResponseSchema),
          },
        },
      },
      400: {
        description: "Bad request or invalid coordinates",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  zValidator("query", weatherQuerySchema),
  async (context: Context) => {
    const query = context.req.valid("query" as never) as {
      longitude: string;
      latitude: string;
    };

    const longitude = query.longitude ? Number.parseFloat(query.longitude) : 0;
    const latitude = query.latitude ? Number.parseFloat(query.latitude) : 0;

    if (!longitude || !latitude) {
      throw new AssistantError(
        "Invalid longitude or latitude",
        ErrorType.PARAMS_ERROR,
      );
    }

    const response = await getWeatherForLocation(context.env as IEnv, {
      longitude,
      latitude,
    });
    return context.json({ response });
  },
);

app.post(
  "/web-search",
  describeRoute({
    tags: ["apps"],
    description: "Perform a deep web search",
    responses: {
      200: {
        description: "Web search results",
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
  zValidator("json", deepWebSearchSchema),
  async (context: Context) => {
    const body = context.req.valid("json" as never) as DeepWebSearchParams;
    const user = context.get("user");

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

    const planCheck = checkPlanRequirement(user, "pro");
    if (!planCheck.isValid) {
      return context.json(
        {
          response: {
            status: "error",
            message: planCheck.message,
          },
        },
        401,
      );
    }

    const response = await performDeepWebSearch(
      context.env as IEnv,
      user,
      body,
    );

    return context.json({
      response,
    });
  },
);

app.post(
  "/tutor",
  describeRoute({
    tags: ["apps"],
    description: "Get tutoring on a specific topic",
    responses: {
      200: {
        description: "Tutoring response with educational content",
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
  zValidator("json", tutorSchema),
  async (context: Context) => {
    const body = context.req.valid("json" as never) as TutorRequestParams;
    const user = context.get("user");

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

    const planCheck = checkPlanRequirement(user, "pro");
    if (!planCheck.isValid) {
      return context.json(
        {
          response: {
            status: "error",
            message: planCheck.message,
          },
        },
        401,
      );
    }

    const response = await completeTutorRequest(
      context.env as IEnv,
      user,
      body,
    );

    return context.json({
      response,
    });
  },
);

export default app;

import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";

import { requireAuth } from "~/middleware/auth";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import {
  type ContentExtractParams,
  extractContent,
} from "~/services/apps/content-extract";
import { generateImageFromDrawing } from "~/services/apps/drawing/create";
import { guessDrawingFromImage } from "~/services/apps/drawing/guess";
import { type OcrParams, performOcr } from "~/services/apps/ocr";
import { handlePromptCoachSuggestion } from "~/services/apps/prompt-coach";
import {
  type CaptureScreenshotParams,
  captureScreenshot,
} from "~/services/apps/screenshot";
import {
  type TutorRequestParams,
  completeTutorRequest,
} from "~/services/apps/tutor";
import { getWeatherForLocation } from "~/services/apps/weather";
import {
  type DeepWebSearchParams,
  performDeepWebSearch,
} from "~/services/apps/web-search";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import {
  captureScreenshotSchema,
  contentExtractSchema,
  deepWebSearchSchema,
  drawingSchema,
  guessDrawingSchema,
  ocrSchema,
  promptCoachJsonSchema,
  promptCoachResponseSchema,
  tutorSchema,
  weatherQuerySchema,
  weatherResponseSchema,
} from "../schemas/apps";
import { apiResponseSchema, errorResponseSchema } from "../schemas/shared";
import articles from "./articles";
import embeddings from "./embeddings";
import generate from "./generate";
import notes from "./notes";
import podcasts from "./podcasts";

const app = new Hono();

const routeLogger = createRouteLogger("APPS");

app.use("/*", (c, next) => {
  routeLogger.info(`Processing apps route: ${c.req.path}`);
  return next();
});

app.use("/*", requireAuth);

app.route("/embeddings", embeddings);

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

app.route("/generate", generate);

app.post(
  "/drawing",
  describeRoute({
    tags: ["apps"],
    description: "Generate an image from a drawing",
    responses: {
      200: {
        description: "Response",
        content: {
          "application/json": {
            schema: resolver(apiResponseSchema),
          },
        },
      },
    },
  }),
  zValidator("form", drawingSchema),
  async (context: Context) => {
    const body = context.req.valid("form" as never);
    const user = context.get("user");

    const response = await generateImageFromDrawing({
      env: context.env as IEnv,
      request: body,
      user,
    });

    if (response.status === "error") {
      throw new AssistantError(
        "Something went wrong, we are working on it",
        ErrorType.UNKNOWN_ERROR,
      );
    }

    return context.json({
      response,
    });
  },
);

app.post(
  "/guess-drawing",
  describeRoute({
    tags: ["apps"],
    description: "Guess a drawing from an image",
    responses: {
      200: {
        description: "Response",
        content: {
          "application/json": {
            schema: resolver(apiResponseSchema),
          },
        },
      },
    },
  }),
  zValidator("form", guessDrawingSchema),
  async (context: Context) => {
    const body = context.req.valid("form" as never);
    const user = context.get("user");

    const response = await guessDrawingFromImage({
      env: context.env as IEnv,
      request: body,
      user,
    });

    if (response.status === "error") {
      throw new AssistantError(
        "Something went wrong, we are working on it",
        ErrorType.UNKNOWN_ERROR,
      );
    }

    return context.json({
      response,
    });
  },
);

app.route("/podcasts", podcasts);

app.route("/articles", articles);

app.route("/notes", notes);

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

    const result = await performOcr(body, {
      env: context.env as IEnv,
      user,
    });

    return context.json(result);
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

app.post(
  "/prompt-coach",
  describeRoute({
    tags: ["chat"],
    summary: "Get prompt suggestion using coaching system",
    description:
      "Takes a user prompt, runs it through the existing coaching system prompt, and returns the suggested revised prompt.",
    responses: {
      200: {
        description: "Suggested revised prompt extracted from AI response",
        content: {
          "application/json": {
            schema: resolver(promptCoachResponseSchema),
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
      500: {
        description:
          "Internal server error during suggestion generation or extraction",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  zValidator("json", promptCoachJsonSchema),
  async (context: Context) => {
    const { prompt: userPrompt } = context.req.valid("json" as never) as {
      prompt: string;
    };
    const userContext = context.get("user") as IUser | undefined;
    const env = context.env as IEnv;

    const result = await handlePromptCoachSuggestion({
      env,
      user: userContext,
      prompt: userPrompt,
    });

    return context.json(result);
  },
);

export default app;

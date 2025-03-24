import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";

import { requireAuth } from "../middleware/auth";
import { createRouteLogger } from "../middleware/loggerMiddleware";
import {
  type Params as AnalyseArticleParams,
  analyseArticle,
} from "../services/apps/articles/analyse";
import {
  type Params as GenerateArticlesReportParams,
  generateArticlesReport,
} from "../services/apps/articles/generate-report";
import {
  type Params as SummariseArticleParams,
  summariseArticle,
} from "../services/apps/articles/summarise";
import {
  type ContentExtractParams,
  extractContent,
} from "../services/apps/content-extract";
import { generateImageFromDrawing } from "../services/apps/drawing/create";
import { guessDrawingFromImage } from "../services/apps/drawing/guess";
import {
  type IDeleteEmbeddingRequest,
  deleteEmbedding,
} from "../services/apps/embeddings/delete";
import {
  type IInsertEmbeddingRequest,
  insertEmbedding,
} from "../services/apps/embeddings/insert";
import { queryEmbeddings } from "../services/apps/embeddings/query";
import {
  type ImageGenerationParams,
  generateImage,
} from "../services/apps/generate/image";
import {
  type MusicGenerationParams,
  generateMusic,
} from "../services/apps/generate/music";
import {
  type SpeechGenerationParams,
  generateSpeech,
} from "../services/apps/generate/speech";
import {
  type VideoGenerationParams,
  generateVideo,
} from "../services/apps/generate/video";
import { type OcrParams, performOcr } from "../services/apps/ocr";
import { handlePodcastGenerateImage } from "../services/apps/podcast/generate-image";
import {
  type IPodcastSummariseBody,
  handlePodcastSummarise,
} from "../services/apps/podcast/summarise";
import {
  type IPodcastTranscribeBody,
  handlePodcastTranscribe,
} from "../services/apps/podcast/transcribe";
import {
  type UploadRequest,
  handlePodcastUpload,
} from "../services/apps/podcast/upload";
import {
  type CaptureScreenshotParams,
  captureScreenshot,
} from "../services/apps/screenshot";
import {
  type TutorRequestParams,
  completeTutorRequest,
} from "../services/apps/tutor";
import { getWeatherForLocation } from "../services/apps/weather";
import {
  type DeepWebSearchParams,
  performDeepWebSearch,
} from "../services/apps/web-search";
import type { IEnv } from "../types";
import { AssistantError, ErrorType } from "../utils/errors";
import {
  articleAnalyzeSchema,
  articleSummariseSchema,
  captureScreenshotSchema,
  contentExtractSchema,
  deepWebSearchSchema,
  deleteEmbeddingSchema,
  drawingSchema,
  generateArticlesReportSchema,
  guessDrawingSchema,
  imageGenerationSchema,
  insertEmbeddingSchema,
  musicGenerationSchema,
  ocrSchema,
  podcastGenerateImageSchema,
  podcastSummarizeSchema,
  podcastTranscribeSchema,
  podcastUploadSchema,
  queryEmbeddingsSchema,
  speechGenerationSchema,
  tutorSchema,
  videoGenerationSchema,
  weatherQuerySchema,
} from "./schemas/apps";

const app = new Hono();

const routeLogger = createRouteLogger("APPS");

/**
 * Global middleware to add route-specific logging
 */
app.use("/*", (c, next) => {
  routeLogger.info(`Processing apps route: ${c.req.path}`);
  return next();
});

/**
 * Global middleware to check authentication
 */
app.use("/*", requireAuth);

app.post(
  "/insert-embedding",
  describeRoute({
    tags: ["apps"],
    description: "Insert an embedding into the database",
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
  zValidator("json", insertEmbeddingSchema),
  async (context: Context) => {
    const body = context.req.valid(
      "json" as never,
    ) as IInsertEmbeddingRequest["request"];

    const response = await insertEmbedding({
      request: body,
      env: context.env as IEnv,
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

app.get(
  "/query-embeddings",
  describeRoute({
    tags: ["apps"],
    description: "Query embeddings from the database",
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
  zValidator("query", queryEmbeddingsSchema),
  async (context: Context) => {
    const query = context.req.valid("query" as never);

    const response = await queryEmbeddings({
      env: context.env as IEnv,
      request: { query },
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
  "/delete-embeddings",
  describeRoute({
    tags: ["apps"],
    description: "Delete embeddings from the database",
  }),
  zValidator("json", deleteEmbeddingSchema),
  async (context: Context) => {
    const body = context.req.valid(
      "json" as never,
    ) as IDeleteEmbeddingRequest["request"];

    const response = await deleteEmbedding({
      env: context.env as IEnv,
      request: body,
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

app.get(
  "/weather",
  describeRoute({
    tags: ["apps"],
    description: "Get the weather for a location",
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
  "/generate-image",
  describeRoute({
    tags: ["apps"],
    description: "Generate an image",
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
  zValidator("json", imageGenerationSchema),
  async (context: Context) => {
    const body = context.req.valid("json" as never) as ImageGenerationParams;

    const completion_id = Math.random().toString(36).substring(2, 15);

    const newUrl = new URL(context.req.url);
    const app_url = `${newUrl.protocol}//${newUrl.hostname}`;

    const response = await generateImage({
      completion_id,
      env: context.env as IEnv,
      args: body,
      app_url,
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
  "/generate-video",
  describeRoute({
    tags: ["apps"],
    description: "Generate a video",
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
  zValidator("json", videoGenerationSchema),
  async (context: Context) => {
    const body = context.req.valid("json" as never) as VideoGenerationParams;

    const completion_id = Math.random().toString(36).substring(2, 15);

    const newUrl = new URL(context.req.url);
    const app_url = `${newUrl.protocol}//${newUrl.hostname}`;

    const response = await generateVideo({
      completion_id,
      env: context.env as IEnv,
      args: body,
      app_url,
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
  "/generate-music",
  describeRoute({
    tags: ["apps"],
    description: "Generate music",
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
  zValidator("json", musicGenerationSchema),
  async (context: Context) => {
    const body = context.req.valid("json" as never) as MusicGenerationParams;

    const completion_id = Math.random().toString(36).substring(2, 15);

    const newUrl = new URL(context.req.url);
    const app_url = `${newUrl.protocol}//${newUrl.hostname}`;

    const response = await generateMusic({
      completion_id,
      env: context.env as IEnv,
      args: body,
      app_url,
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
  "/generate-speech",
  describeRoute({
    tags: ["apps"],
    description: "Generate speech from text",
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
  zValidator("json", speechGenerationSchema),
  async (context: Context) => {
    const body = context.req.valid("json" as never) as SpeechGenerationParams;

    const completion_id = Math.random().toString(36).substring(2, 15);

    const newUrl = new URL(context.req.url);
    const app_url = `${newUrl.protocol}//${newUrl.hostname}`;

    const response = await generateSpeech({
      completion_id,
      env: context.env as IEnv,
      args: body,
      app_url,
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
  "/drawing",
  describeRoute({
    tags: ["apps"],
    description: "Generate an image from a drawing",
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
            schema: resolver(z.object({})),
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

app.post(
  "/podcasts/upload",
  describeRoute({
    tags: ["apps", "podcasts"],
    description: "Upload a podcast",
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
  zValidator("json", podcastUploadSchema),
  async (context: Context) => {
    const body = context.req.valid("json" as never) as UploadRequest["request"];
    const user = context.get("user");

    const response = await handlePodcastUpload({
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
  "/podcasts/transcribe",
  describeRoute({
    tags: ["apps", "podcasts"],
    description: "Transcribe a podcast",
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
  zValidator("json", podcastTranscribeSchema),
  async (context: Context) => {
    const body = context.req.valid("json" as never) as IPodcastTranscribeBody;
    const user = context.get("user");

    const newUrl = new URL(context.req.url);
    const app_url = `${newUrl.protocol}//${newUrl.hostname}`;

    const response = await handlePodcastTranscribe({
      env: context.env as IEnv,
      request: body,
      user,
      app_url,
    });

    return context.json({
      response,
    });
  },
);

app.post(
  "/podcasts/summarise",
  describeRoute({
    tags: ["apps", "podcasts"],
    description: "Summarise a podcast",
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
  zValidator("json", podcastSummarizeSchema),
  async (context: Context) => {
    const body = context.req.valid("json" as never) as IPodcastSummariseBody;
    const user = context.get("user");

    const response = await handlePodcastSummarise({
      env: context.env as IEnv,
      request: body,
      user,
    });

    return context.json({
      response,
    });
  },
);

app.post(
  "/podcasts/generate-image",
  describeRoute({
    tags: ["apps", "podcasts"],
    description: "Generate an image for a podcast",
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
  zValidator("json", podcastGenerateImageSchema),
  async (context: Context) => {
    const body = context.req.valid("json" as never) as IPodcastTranscribeBody;
    const user = context.get("user");

    const response = await handlePodcastGenerateImage({
      env: context.env as IEnv,
      request: body,
      user,
    });

    return context.json({
      response,
    });
  },
);

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

    const completion_id = Math.random().toString(36).substring(2, 15);

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

    const completion_id = Math.random().toString(36).substring(2, 15);

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

    const completion_id = Math.random().toString(36).substring(2, 15);

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
        description: "OCR result",
        content: {
          "application/json": {
            schema: z.object({
              status: z.string(),
              data: z.object({}).optional(),
              error: z.string().optional(),
            }),
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
    description: "Web search",
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
    description: "Tutor",
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

export default app;

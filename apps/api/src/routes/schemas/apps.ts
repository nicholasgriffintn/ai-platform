import { z } from "zod/v4";

export const insertEmbeddingSchema = z.object({
  type: z.string(),
  content: z.string(),
  id: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  title: z.string().optional(),
  rag_options: z
    .object({
      namespace: z.string().optional(),
    })
    .optional(),
});

export const queryEmbeddingsSchema = z.object({
  query: z.string(),
  namespace: z.string().optional(),
});

export const deleteEmbeddingSchema = z.object({
  ids: z.array(z.string()),
});

export const weatherQuerySchema = z.object({
  longitude: z.string().transform((val) => Number.parseFloat(val)),
  latitude: z.string().transform((val) => Number.parseFloat(val)),
});

export const imageGenerationSchema = z.object({
  prompt: z.string(),
  image_style: z.enum([
    "default",
    "art-deco",
    "cinematic",
    "cyberpunk",
    "fantasy",
    "graffiti",
    "impressionist",
    "minimal",
    "moody",
    "noir",
    "pop-art",
    "retro",
    "surreal",
    "vaporwave",
    "vibrant",
    "watercolor",
  ]),
  steps: z.number().optional(),
});

export const videoGenerationSchema = z.object({
  prompt: z.string(),
  negative_prompt: z.string().optional(),
  guidance_scale: z.number().optional(),
  video_length: z.number().optional(),
  height: z.number().optional(),
  width: z.number().optional(),
});

export const musicGenerationSchema = z.object({
  prompt: z.string(),
  input_audio: z.string().optional(),
  duration: z.number().optional(),
});

export const drawingSchema = z.object({
  drawing: z.any(),
  drawingId: z.string().optional(),
});

export const guessDrawingSchema = z.object({
  drawing: z.any(),
});

export const podcastTranscribeSchema = z.object({
  podcastId: z.string(),
  numberOfSpeakers: z.number(),
  prompt: z.string(),
});

export const podcastSummarizeSchema = z.object({
  podcastId: z.string(),
  speakers: z.record(z.string(), z.string()),
});

export const podcastGenerateImageSchema = z.object({
  podcastId: z.string(),
  prompt: z.string().optional(),
});

export const articleAnalyzeSchema = z.object({
  article: z.string(),
  itemId: z.string(),
});

export const articleSummariseSchema = z.object({
  article: z.string(),
  itemId: z.string(),
});

export const generateArticlesReportSchema = z.object({
  itemId: z.string(),
});

export const contentExtractSchema = z.object({
  urls: z.array(z.url()),
  extract_depth: z.enum(["basic", "advanced"]).optional(),
  include_images: z.boolean().optional(),
  should_vectorize: z.boolean().optional(),
  namespace: z.string().optional(),
});

export const captureScreenshotSchema = z.object({
  url: z.string().optional(),
  html: z.string().optional(),
  screenshotOptions: z
    .object({
      omitBackground: z.boolean().optional(),
      fullPage: z.boolean().optional(),
    })
    .optional(),
  viewport: z
    .object({
      width: z.number().optional(),
      height: z.number().optional(),
    })
    .optional(),
  gotoOptions: z
    .object({
      waitUntil: z.enum(["domcontentloaded", "networkidle0"]).optional(),
      timeout: z.number().optional(),
    })
    .optional(),
  addScriptTag: z
    .array(
      z.object({
        url: z.string().optional(),
        content: z.string().optional(),
      }),
    )
    .optional(),
  addStyleTag: z
    .array(
      z.object({
        url: z.string().optional(),
        content: z.string().optional(),
      }),
    )
    .optional(),
});

export const ocrSchema = z.object({
  model: z.enum(["mistral-ocr-latest"]).optional(),
  document: z.object({
    type: z.enum(["document_url"]).optional(),
    document_url: z.string(),
    document_name: z.string().optional(),
  }),
  id: z.string().optional(),
  pages: z.array(z.number()).optional().meta({
    description:
      "Specific pages user wants to process in various formats: single number, range, or list of both. Starts from 0",
  }),
  include_image_base64: z.boolean().optional().meta({
    description:
      "Whether to include the images in a base64 format in the response",
  }),
  image_limit: z.number().optional().meta({
    description: "Limit the number of images to extract",
  }),
  image_min_size: z.number().optional().meta({
    description: "Minimum height and width of image to extract",
  }),
  output_format: z.enum(["json", "html", "markdown"]).optional().meta({
    description: "Output format of the response",
  }),
});

export const speechGenerationSchema = z.object({
  prompt: z.string(),
  lang: z.string().optional(),
});

export const deepWebSearchSchema = z.object({
  query: z.string(),
  options: z
    .object({
      search_depth: z.enum(["basic", "advanced"]).optional(),
      include_answer: z.boolean().optional(),
      include_raw_content: z.boolean().optional(),
      include_images: z.boolean().optional(),
    })
    .optional(),
});

export const tutorSchema = z.object({
  topic: z.string(),
  level: z
    .enum(["beginner", "intermediate", "advanced"])
    .prefault("advanced")
    .optional(),
  options: z
    .object({
      search_depth: z.enum(["basic", "advanced"]).optional(),
      include_answer: z.boolean().optional(),
      include_raw_content: z.boolean().optional(),
      include_images: z.boolean().optional(),
    })
    .optional(),
});

export const promptCoachJsonSchema = z.object({
  prompt: z.string().describe("The user's prompt to get suggestions for."),
  promptType: z
    .enum(["general", "creative", "technical", "instructional", "analytical"])
    .optional()
    .describe("The type of prompt to get suggestions for."),
  recursionDepth: z
    .number()
    .optional()
    .describe("The depth of the recursion for the prompt coach."),
});

export const promptCoachResponseSchema = z.object({
  suggested_prompt: z
    .string()
    .nullable()
    .describe("The suggested improvement for the user's prompt."),
});

export const appInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  icon: z.string().optional(),
  category: z.string().optional(),
});

export const appInfoArraySchema = z.array(appInfoSchema);

export const dynamicAppIdParamSchema = z.object({ id: z.string() });

export const dynamicAppExecuteRequestSchema = z.record(z.string(), z.any());

export const weatherResponseSchema = z.object({
  response: z.object({
    status: z.enum(["success", "error"]),
    name: z.string(),
    content: z.string(),
    data: z
      .object({
        cod: z.number(),
        main: z.object({
          temp: z.number(),
          feels_like: z.number(),
          temp_min: z.number(),
          temp_max: z.number(),
          pressure: z.number(),
          humidity: z.number(),
        }),
        weather: z.array(
          z.object({
            main: z.string(),
            description: z.string(),
          }),
        ),
        wind: z.object({
          speed: z.number(),
          deg: z.number(),
        }),
        clouds: z.object({ all: z.number() }),
        sys: z.object({ country: z.string() }),
        name: z.string(),
      })
      .optional(),
  }),
});

export const listArticlesResponseSchema = z.object({
  articles: z.array(z.any()),
});

export const sourceArticlesResponseSchema = z.object({
  status: z.string(),
  articles: z.array(z.any()),
});

export const articleDetailResponseSchema = z.object({
  article: z.any(),
});

export const listPodcastsResponseSchema = z.object({
  podcasts: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      createdAt: z.string(),
      imageUrl: z.string().optional(),
      duration: z.number().optional(),
      status: z.enum(["processing", "transcribing", "summarizing", "complete"]),
    }),
  ),
});

export const podcastDetailResponseSchema = z.object({
  podcast: z.object({
    id: z.string(),
    title: z.string(),
    description: z.string().optional(),
    createdAt: z.string(),
    imageUrl: z.string().optional(),
    audioUrl: z.string(),
    duration: z.number().optional(),
    transcript: z.string().optional(),
    summary: z.string().optional(),
    status: z.enum(["processing", "transcribing", "summarizing", "complete"]),
  }),
});

export const noteSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const noteCreateSchema = z.object({
  title: z.string(),
  content: z.string(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const noteUpdateSchema = noteCreateSchema;

export const listNotesResponseSchema = z.object({
  notes: z.array(noteSchema),
});

export const noteDetailResponseSchema = z.object({
  note: noteSchema,
});

export const noteFormatSchema = z.object({
  prompt: z.string().optional().meta({
    description:
      "Optional additional instructions to refine the note formatting",
  }),
});

export const noteFormatResponseSchema = z.object({
  content: z.string().meta({
    description: "The reformatted note contents",
  }),
});

export const shareItemSchema = z
  .object({
    app_id: z.string().meta({
      description: "The ID of the app",
    }),
  })
  .meta({
    description: "Schema for sharing an app item",
  });

export const sharedItemResponseSchema = z
  .object({
    status: z.enum(["success", "error"]),
    share_id: z.string().optional(),
    message: z.string().optional(),
    item: z
      .object({
        id: z.string(),
        app_id: z.string(),
        item_id: z.string().optional(),
        item_type: z.string().optional(),
        data: z.any(),
        share_id: z.string().optional(),
        created_at: z.string(),
        updated_at: z.string(),
      })
      .optional(),
  })
  .meta({
    description: "Response for shared item operations",
  });
